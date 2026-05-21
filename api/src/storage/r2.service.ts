import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class R2Service {
  private client: S3Client | null = null;
  private bucket = '';
  private publicUrl = '';
  private readonly logger = new Logger(R2Service.name);

  constructor(private config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID');
    this.bucket = config.get<string>('R2_BUCKET', '');
    this.publicUrl = config.get<string>('R2_PUBLIC_URL', '');

    if (accountId && this.bucket) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.get<string>('R2_ACCESS_KEY_ID', ''),
          secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY', ''),
        },
      });
    } else {
      this.logger.warn('R2 storage not configured — image upload disabled');
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    if (!this.client) {
      throw new InternalServerErrorException('R2 storage not configured');
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return `${this.publicUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      this.logger.warn(`R2 delete failed: ${key}`, err);
    }
  }

  buildKey(tenantId: string, productId: string, imageId: string): string {
    return `tenant-${tenantId}/products/${productId}/${imageId}.webp`;
  }

  buildBrandingKey(tenantId: string, type: 'logo' | 'banner'): string {
    return `tenant-${tenantId}/branding/${type}.webp`;
  }
}
