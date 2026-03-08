import { Client } from 'minio';

const BUCKET = process.env.MINIO_BUCKET ?? 'helpdesk';

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
});

export async function ensureBucketExists() {
  try {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) {
      await minioClient.makeBucket(BUCKET);
      console.log(`[storage] Created bucket: ${BUCKET}`);
    }
  } catch (err) {
    console.error('[storage] Failed to ensure bucket exists:', err);
  }
}

export async function uploadFile(
  key: string,
  data: Buffer | Uint8Array,
  mimeType: string
): Promise<void> {
  await minioClient.putObject(BUCKET, key, Buffer.from(data), undefined, {
    'Content-Type': mimeType,
  });
}

export async function getFileUrl(key: string, expirySeconds = 3600): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, key, expirySeconds);
}

export async function deleteFile(key: string): Promise<void> {
  await minioClient.removeObject(BUCKET, key);
}

export function generateStorageKey(ticketId: string, fileName: string): string {
  const timestamp = Date.now();
  const ext = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `tickets/${ticketId}/${timestamp}_${safe}`;
}
