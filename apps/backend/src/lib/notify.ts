import { db } from './db';
import { notifications } from './db/schema';

export async function createNotification({
  userId,
  type,
  title,
  body,
  entityType,
  entityId,
}: {
  userId: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}) {
  try {
    await db.insert(notifications).values({
      userId,
      type,
      title,
      body,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
    });
  } catch (err) {
    console.error('[notify] Failed to create notification:', err);
  }
}
