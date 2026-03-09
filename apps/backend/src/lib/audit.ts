import { db } from './db';
import { auditLogs } from './db/schema';
import type { User } from '../auth';

export type AuditAction =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.closed'
  | 'ticket.assigned'
  | 'ticket.reassigned'
  | 'ticket.status_changed'
  | 'ticket.priority_changed'
  | 'ticket.description_edited'
  | 'message.created'
  | 'message.edited'
  | 'user.role_changed'
  | 'user.company_changed'
  | 'user.deactivated'
  | 'invitation.sent'
  | 'invitation.accepted'
  | 'invitation.revoked'
  | 'company.created'
  | 'company.updated'
  | 'company.deleted'
  | 'attachment.uploaded'
  | 'attachment.deleted'
  | 'integration.added'
  | 'integration.removed';

export async function createAuditLog({
  actor,
  action,
  entityType,
  entityId,
  oldValue,
  newValue,
  ipAddress,
}: {
  actor: User;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action,
      entityType,
      entityId,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      ipAddress: ipAddress ?? null,
    });
  } catch (err) {
    console.error('[audit] Failed to create audit log:', err);
  }
}
