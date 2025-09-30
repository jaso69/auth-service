// lib/r2-client.js
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Configuración de R2
const R2_CONFIG = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME || 'rpg-docu'
};

// Cliente S3 compatible con R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
});

export class R2Client {
  static async uploadDocument(file, documentId) {
    const fileExtension = file.originalname.split('.').pop();
    const key = `documents/${documentId}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        'original-filename': file.originalname,
        'uploaded-at': new Date().toISOString()
      }
    });

    await s3Client.send(command);

    // URL pública del archivo
    return `https://pub-${R2_CONFIG.accountId}.r2.dev/${key}`;
  }

  static async generateUploadURL(documentId, fileType) {
    const fileExtension = fileType.split('/')[1];
    const key = `documents/${documentId}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      ContentType: fileType,
    });

    // URL firmada para subida directa desde el frontend
    const signedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600 // 1 hora
    });

    return {
      signedUrl,
      publicUrl: `https://pub-${R2_CONFIG.accountId}.r2.dev/${key}`,
      key
    };
  }

  static async deleteDocument(fileUrl) {
    try {
      const key = fileUrl.split('/').pop();
      const command = new DeleteObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: `documents/${key}`
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting from R2:', error);
      return false;
    }
  }
}