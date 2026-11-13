'use strict';

/**
 * MinIO client for S3-compatible object storage.
 * Used for video uploads (presigned URLs) and HLS segment storage.
 */

const { Minio } = require('minio');

let minioClient = null;

function getMinioClient() {
  if (minioClient) return minioClient;

  const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
  const port = parseInt(process.env.MINIO_PORT || '9000', 10);
  const useSSL = process.env.MINIO_USE_SSL === 'true';
  const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
  const bucket = process.env.MINIO_BUCKET || 'vibra-media';

  minioClient = new Minio({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });

  // Ensure bucket exists
  minioClient.bucketExists(bucket).then((exists) => {
    if (!exists) {
      return minioClient.makeBucket(bucket, 'us-east-1');
    }
  }).catch((err) => {
    console.error('[MinIO] Bucket check failed:', err.message);
  });

  return minioClient;
}

function getBucket() {
  return process.env.MINIO_BUCKET || 'vibra-media';
}

/**
 * Generate presigned PUT URL for direct browser upload.
 * @param {string} objectKey - Key/path in bucket
 * @param {number} expirySeconds - URL validity (default 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
async function presignPut(objectKey, expirySeconds = 3600) {
  const client = getMinioClient();
  const bucket = getBucket();
  return client.presignedPutObject(bucket, objectKey, expirySeconds);
}

/**
 * Generate presigned GET URL for private object access.
 * @param {string} objectKey - Key/path in bucket
 * @param {number} expirySeconds - URL validity (default 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
async function presignGet(objectKey, expirySeconds = 3600) {
  const client = getMinioClient();
  const bucket = getBucket();
  return client.presignedGetObject(bucket, objectKey, expirySeconds);
}

/**
 * Upload buffer/stream directly (server-side).
 * @param {string} objectKey - Key/path in bucket
 * @param {Buffer|Readable} data - Data to upload
 * @param {object} meta - Metadata (contentType, etc)
 * @returns {Promise<{etag: string}>}
 */
async function putObject(objectKey, data, meta = {}) {
  const client = getMinioClient();
  const bucket = getBucket();
  return client.putObject(bucket, objectKey, data, meta);
}

/**
 * Delete object from bucket.
 * @param {string} objectKey - Key/path in bucket
 */
async function removeObject(objectKey) {
  const client = getMinioClient();
  const bucket = getBucket();
  return client.removeObject(bucket, objectKey);
}

/**
 * List objects with prefix (e.g., HLS segments).
 * @param {string} prefix - Prefix to filter
 * @returns {AsyncIterable}
 */
function listObjects(prefix) {
  const client = getMinioClient();
  const bucket = getBucket();
  return client.listObjects(bucket, prefix, true);
}

/**
 * Get object stat (size, etag, etc).
 */
async function statObject(objectKey) {
  const client = getMinioClient();
  const bucket = getBucket();
  return client.statObject(bucket, objectKey);
}

module.exports = {
  getMinioClient,
  getBucket,
  presignPut,
  presignGet,
  putObject,
  removeObject,
  listObjects,
  statObject,
};