import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { logger } from '../logger';
import type { S3Config } from '@/types';
import { decrypt } from '../encryption';

/**
 * Create S3 client from configuration
 */
export async function createS3Client(config: S3Config): Promise<S3Client> {
  const accessKeyId = await decrypt(config.AccessKeyIdEncrypted);
  const secretAccessKey = await decrypt(config.SecretAccessKeyEncrypted);

  const clientConfig: any = {
    region: config.Region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };

  if (config.Endpoint) {
    clientConfig.endpoint = config.Endpoint;
    clientConfig.forcePathStyle = true; // Required for MinIO and some S3-compatible services
  }

  return new S3Client(clientConfig);
}

/**
 * Test S3 connection
 */
export async function testS3Connection(config: S3Config): Promise<boolean> {
  try {
    const client = await createS3Client(config);
    const command = new HeadBucketCommand({ Bucket: config.Bucket });
    await client.send(command);
    return true;
  } catch (error) {
    logger.error('S3 connection test failed', { error });
    return false;
  }
}

/**
 * Upload file to S3
 */
export interface S3UploadOptions {
  bucket: string;
  key: string;
  filePath: string;
  metadata?: Record<string, string>;
  onProgress?: (progress: number) => void;
}

export async function uploadToS3(
  s3Config: S3Config,
  options: S3UploadOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await createS3Client(s3Config);
    const fileStream = createReadStream(options.filePath);

    const upload = new Upload({
      client,
      params: {
        Bucket: options.bucket,
        Key: options.key,
        Body: fileStream,
        Metadata: options.metadata,
        ServerSideEncryption: 'AES256',
      },
    });

    // Track progress if callback provided
    if (options.onProgress) {
      upload.on('httpUploadProgress', (progress) => {
        if (progress.loaded && progress.total) {
          const percentage = (progress.loaded / progress.total) * 100;
          options.onProgress!(percentage);
        }
      });
    }

    await upload.done();

    logger.info('File uploaded to S3', {
      bucket: options.bucket,
      key: options.key,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('S3 upload failed', {
      bucket: options.bucket,
      key: options.key,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Download file from S3
 */
export interface S3DownloadOptions {
  bucket: string;
  key: string;
  destinationPath: string;
}

export async function downloadFromS3(
  s3Config: S3Config,
  options: S3DownloadOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await createS3Client(s3Config);
    const command = new GetObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error('No data received from S3');
    }

    // Stream to file
    const writeStream = createWriteStream(options.destinationPath);
    await pipeline(response.Body as any, writeStream);

    logger.info('File downloaded from S3', {
      bucket: options.bucket,
      key: options.key,
      destination: options.destinationPath,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('S3 download failed', {
      bucket: options.bucket,
      key: options.key,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete file from S3
 */
export interface S3DeleteOptions {
  bucket: string;
  key: string;
}

export async function deleteFromS3(
  s3Config: S3Config,
  options: S3DeleteOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await createS3Client(s3Config);
    const command = new DeleteObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
    });

    await client.send(command);

    logger.info('File deleted from S3', {
      bucket: options.bucket,
      key: options.key,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('S3 delete failed', {
      bucket: options.bucket,
      key: options.key,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * List objects in S3 bucket
 */
export interface S3ListOptions {
  bucket: string;
  prefix?: string;
  maxKeys?: number;
}

export async function listS3Objects(
  s3Config: S3Config,
  options: S3ListOptions
): Promise<{ success: boolean; objects?: any[]; error?: string }> {
  try {
    const client = await createS3Client(s3Config);
    const command = new ListObjectsV2Command({
      Bucket: options.bucket,
      Prefix: options.prefix,
      MaxKeys: options.maxKeys || 1000,
    });

    const response = await client.send(command);

    return {
      success: true,
      objects: response.Contents || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('S3 list failed', {
      bucket: options.bucket,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Generate S3 key for backup file
 */
export function generateS3Key(
  pathPrefix: string,
  databaseName: string,
  fileName: string
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const prefix = pathPrefix ? `${pathPrefix}/` : '';
  return `${prefix}${databaseName}/${year}/${month}/${fileName}`;
}
