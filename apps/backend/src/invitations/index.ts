import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { invitations, users } from '../lib/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { authPlugin, requireRole } from '../auth';
import { invitationsModel } from './model';
import { hashPassword } from '../auth/password';
import { sendEmail, emailTemplates } from '../lib/email';
import { createAuditLog } from '../lib/audit';

function generateToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}

export const invitationsRoutes = new Elysia({ prefix: '/invitations' })
  .use(invitationsModel)
  .use(authPlugin)
  // Create invitation (admin only)
  .post(
    '/',
    async ({ body, user, set }) => {
      const authed = requireRole(user, 'admin');

      // Check if user already exists
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);

      if (existing) {
        set.status = 409;
        return { error: 'User with this email already exists' };
      }

      // Check for pending invitation
      const [pendingInvite] = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.email, body.email),
            isNull(invitations.acceptedAt),
            gt(invitations.expiresAt, new Date())
          )
        )
        .limit(1);

      if (pendingInvite) {
        set.status = 409;
        return { error: 'Pending invitation already exists for this email' };
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [invitation] = await db
        .insert(invitations)
        .values({
          email: body.email,
          role: body.role ?? 'customer',
          companyId: body.companyId ?? null,
          invitedBy: authed.id,
          token,
          expiresAt,
        })
        .returning();

      // Send invitation email (non-blocking)
      const tmpl = emailTemplates.inviteUser(body.role ?? 'customer', token);
      sendEmail(body.email, tmpl.subject, tmpl.html);

      await createAuditLog({
        actor: authed,
        action: 'invitation.sent',
        entityType: 'invitation',
        entityId: invitation!.id,
        newValue: { email: body.email, role: body.role ?? 'customer' },
      });

      set.status = 201;
      return invitation;
    },
    { body: 'invitation.create' }
  )
  // List pending invitations
  .get('/', async ({ user }) => {
    requireRole(user, 'admin');
    return db
      .select()
      .from(invitations)
      .where(and(isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date())));
  })
  // Get invitation by token (public - no auth needed)
  .get(
    '/accept/:token',
    async ({ params, set }) => {
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.token, params.token))
        .limit(1);

      if (!invitation) {
        set.status = 404;
        return { error: 'Invitation not found' };
      }

      if (invitation.acceptedAt) {
        set.status = 410;
        return { error: 'Invitation already accepted' };
      }

      if (invitation.expiresAt < new Date()) {
        set.status = 410;
        return { error: 'Invitation expired' };
      }

      return {
        email: invitation.email,
        role: invitation.role,
        companyId: invitation.companyId,
      };
    },
    { params: 'invitation.params' }
  )
  // Accept invitation (public - no auth needed)
  .post(
    '/accept/:token',
    async ({ params, body, set, cookie }) => {
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.token, params.token))
        .limit(1);

      if (!invitation) {
        set.status = 404;
        return { error: 'Invitation not found' };
      }

      if (invitation.acceptedAt) {
        set.status = 410;
        return { error: 'Invitation already accepted' };
      }

      if (invitation.expiresAt < new Date()) {
        set.status = 410;
        return { error: 'Invitation expired' };
      }

      // Check if email already taken
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, invitation.email))
        .limit(1);

      if (existing) {
        set.status = 409;
        return { error: 'User with this email already exists' };
      }

      const passwordHash = await hashPassword(body.password);

      const [newUser] = await db
        .insert(users)
        .values({
          email: invitation.email,
          passwordHash,
          name: body.name,
          role: invitation.role,
          companyId: invitation.companyId,
        })
        .returning();

      // Mark invitation as accepted
      await db
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invitation.id));

      set.status = 201;
      return {
        user: {
          id: newUser!.id,
          email: newUser!.email,
          name: newUser!.name,
          role: newUser!.role,
        },
      };
    },
    {
      params: 'invitation.params',
      body: 'invitation.accept',
    }
  )
  // Revoke invitation
  .delete(
    '/:id',
    async ({ params, user, set }) => {
      const authed = requireRole(user, 'admin');

      const [deleted] = await db
        .delete(invitations)
        .where(eq(invitations.id, params.id))
        .returning();

      if (!deleted) {
        set.status = 404;
        return { error: 'Invitation not found' };
      }

      await createAuditLog({
        actor: authed,
        action: 'invitation.revoked',
        entityType: 'invitation',
        entityId: params.id,
        oldValue: { email: deleted.email },
      });

      return { success: true };
    },
    { params: 'invitation.id.params' }
  );
