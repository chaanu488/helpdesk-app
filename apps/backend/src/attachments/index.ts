import { Elysia } from 'elysia';
import { db } from '../lib/db';
import { attachments, tickets, users } from '../lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { authPlugin, requireAuth } from '../auth';
import { attachmentsModel } from './model';
import { uploadFile, getFileUrl, deleteFile, generateStorageKey } from '../lib/storage';
import { createAuditLog } from '../lib/audit';

// Upload access: only ticket owner or staff can upload files
async function canUploadToTicket(userId: string, role: string, ticket: any): Promise<boolean> {
  if (['agent', 'admin', 'developer'].includes(role)) return true;
  // Only the ticket creator can upload, NOT other company members
  return ticket.customerId === userId;
}

// View access: ticket owner, staff, or same-company PO
async function canViewTicketFiles(userId: string, role: string, ticket: any): Promise<boolean> {
  if (['agent', 'admin', 'developer'].includes(role)) return true;
  if (ticket.customerId === userId) return true;
  if (role === 'product_owner') {
    const [u] = await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, userId)).limit(1);
    const [cu] = await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, ticket.customerId)).limit(1);
    return !!(u?.companyId && u.companyId === cu?.companyId);
  }
  return false;
}

export const attachmentsRoutes = new Elysia({ prefix: '/attachments' })
  .use(attachmentsModel)
  .use(authPlugin)
  .post(
    '/upload',
    async ({ body, user, set }) => {
      const authed = requireAuth(user);

      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, body.ticketId))
        .limit(1);

      if (!ticket) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }

      if (!(await canUploadToTicket(authed.id, authed.role, ticket))) {
        set.status = 403;
        return { error: 'Forbidden' };
      }

      const file = body.file;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const storageKey = generateStorageKey(body.ticketId, file.name);

      await uploadFile(storageKey, buffer, file.type || 'application/octet-stream');

      const [attachment] = await db
        .insert(attachments)
        .values({
          ticketId: body.ticketId,
          messageId: body.messageId ?? null,
          uploadedBy: authed.id,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          storageKey,
        })
        .returning();

      await createAuditLog({
        actor: authed,
        action: 'attachment.uploaded',
        entityType: 'ticket',
        entityId: body.ticketId,
        newValue: { fileName: file.name, fileSize: file.size },
      });

      // Return with presigned URL for immediate display
      const url = await getFileUrl(attachment!.storageKey);
      set.status = 201;
      return { ...attachment, url };
    },
    { body: 'attachment.upload' }
  )
  // List attachments with presigned URLs (batch)
  .get('/tickets/:id', async ({ params, user, set }) => {
    const authed = requireAuth(user);

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, params.id))
      .limit(1);

    if (!ticket) {
      set.status = 404;
      return { error: 'Ticket not found' };
    }

    if (!(await canViewTicketFiles(authed.id, authed.role, ticket))) {
      set.status = 403;
      return { error: 'Forbidden' };
    }

    const rows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.ticketId, params.id));

    // Batch generate presigned URLs
    const withUrls = await Promise.all(
      rows.map(async (att) => ({
        ...att,
        url: att.mimeType?.startsWith('image/') ? await getFileUrl(att.storageKey) : null,
      }))
    );

    return withUrls;
  })
  // Get presigned URL as JSON (for individual file)
  .get('/:attachmentId/url', async ({ params, user, set }) => {
    const authed = requireAuth(user);

    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, params.attachmentId))
      .limit(1);

    if (!attachment) {
      set.status = 404;
      return { error: 'Attachment not found' };
    }

    const url = await getFileUrl(attachment.storageKey);
    return { url, mimeType: attachment.mimeType, fileName: attachment.fileName };
  })
  // Redirect to file
  .get('/:attachmentId', async ({ params, user, set }) => {
    const authed = requireAuth(user);

    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, params.attachmentId))
      .limit(1);

    if (!attachment) {
      set.status = 404;
      return { error: 'Attachment not found' };
    }

    const url = await getFileUrl(attachment.storageKey);
    return new Response(null, {
      status: 302,
      headers: { Location: url },
    });
  })
  .delete('/:attachmentId', async ({ params, user, set }) => {
    const authed = requireAuth(user);

    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, params.attachmentId))
      .limit(1);

    if (!attachment) {
      set.status = 404;
      return { error: 'Attachment not found' };
    }

    const canDelete =
      attachment.uploadedBy === authed.id ||
      ['agent', 'admin', 'developer'].includes(authed.role);

    if (!canDelete) {
      set.status = 403;
      return { error: 'Forbidden' };
    }

    await deleteFile(attachment.storageKey);
    await db.delete(attachments).where(eq(attachments.id, params.attachmentId));

    await createAuditLog({
      actor: authed,
      action: 'attachment.deleted',
      entityType: 'ticket',
      entityId: attachment.ticketId,
      oldValue: { fileName: attachment.fileName },
    });

    return { success: true };
  });
