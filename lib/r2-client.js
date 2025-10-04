// lib/r2-client.js
import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";

// Configuración de R2
const R2_CONFIG = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME || 'rpg-docu',
  publicUrl: `https://pub-${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.dev`
};

// Cliente S3 compatible con R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
  maxAttempts: 3,
});

// Límite para decidir entre upload simple o multiparte (5MB)
const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

export class R2Client {
  /**
   * Subida inteligente que decide entre upload simple o multiparte
   */
 // En r2-client.js - CAMBIA el método uploadDocument para que devuelva solo la URL string:

static async uploadDocument(file, documentId, options = {}) {
  try {
    const { prefix = 'documents', metadata = {} } = options;
    
    const fileName = file.originalname || file.name || `document-${documentId}`;
    const fileExtension = fileName.split('.').pop() || 'bin';
    const key = `${prefix}/${documentId}.${fileExtension}`;

    console.log('📁 Uploading file details:', {
      fileName,
      fileExtension, 
      key,
      size: file.size,
      mimetype: file.mimetype
    });

    let fileBody;
    if (file.buffer) {
      fileBody = file.buffer;
    } else if (file.data) {
      fileBody = file.data;
    } else {
      throw new Error('No se pudo obtener el contenido del archivo');
    }

    // DECIDIR ENTRE UPLOAD SIMPLE O MULTIPARTE
    let result;
    if (file.size <= MULTIPART_THRESHOLD) {
      result = await this._uploadSimple(file, documentId, key, metadata);
    } else {
      result = await this._uploadMultipart(file, documentId, key, metadata, options);
    }

    // ✅ CAMBIO IMPORTANTE: Devolver solo la URL string
    return result.url;
    
  } catch (error) {
    console.error('❌ Error uploading to R2:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
}

  /**
   * Upload simple para archivos pequeños
   */
   static async _uploadSimple(file, documentId, key, metadata = {}) {
    console.log('🔹 Using _uploadSimple');
    
    // Manejo robusto del nombre para _uploadSimple también
    const fileName = file.originalname || file.name || `document-${documentId}`;
    
    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: file.buffer || file.data,
      ContentType: file.mimetype,
      ContentLength: file.size,
      Metadata: {
        'original-filename': Buffer.from(fileName).toString('utf8'),
        'uploaded-at': new Date().toISOString(),
        'document-id': documentId,
        'upload-type': 'simple',
        ...metadata
      }
    });

    await s3Client.send(command);

    return {
      success: true,
      url: `${R2_CONFIG.publicUrl}/${key}`,
      key,
      size: file.size,
      mimetype: file.mimetype,
      uploadType: 'simple'
    };
  }


  /**
   * Upload multiparte para archivos grandes
   */
  static async _uploadMultipart(file, documentId, key, metadata = {}, options = {}) {
    console.log('🔸 Using _uploadMultipart');
    
    // Manejo robusto del nombre para _uploadMultipart también
    const fileName = file.originalname || file.name || `document-${documentId}`;
    const { partSize = 10 * 1024 * 1024 } = options; // 10MB por parte

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        Body: file.buffer || file.data,
        ContentType: file.mimetype,
        ContentLength: file.size,
        Metadata: {
          'original-filename': Buffer.from(fileName).toString('utf8'),
          'uploaded-at': new Date().toISOString(),
          'document-id': documentId,
          'upload-type': 'multipart',
          ...metadata
        }
      },
      partSize: Math.max(partSize, 5 * 1024 * 1024), // Mínimo 5MB por parte
      queueSize: 4, // Número de partes concurrentes
      leavePartsOnError: false,
    });

    // Manejar progreso (opcional)
    upload.on('httpUploadProgress', (progress) => {
      console.log(`📊 Upload progress: ${progress.loaded}/${progress.total} bytes`);
      if (options.onProgress) {
        options.onProgress(progress);
      }
    });

    const result = await upload.done();

    return {
      success: true,
      url: `${R2_CONFIG.publicUrl}/${key}`,
      key,
      size: file.size,
      mimetype: file.mimetype,
      uploadType: 'multipart',
      etag: result.ETag
    };
  }

  /**
   * Generar URL firmada para uploads grandes (hasta 5GB con multiparte)
   */
  static async generateMultipartUploadURL(documentId, fileType, fileSize, options = {}) {
    try {
      const { prefix = 'documents', expiresIn = 3600, metadata = {} } = options;
      const fileExtension = fileType.split('/')[1] || 'bin';
      const key = `${prefix}/${documentId}.${fileExtension}`;

      // Para archivos grandes, necesitamos crear un upload multiparte
      if (fileSize > 100 * 1024 * 1024) { // > 100MB
        return await this._createMultipartUpload(documentId, key, fileType, metadata);
      } else {
        // Para archivos más pequeños, URL firmada normal
        return await this.generateUploadURL(documentId, fileType, options);
      }
    } catch (error) {
      console.error('Error generating multipart upload URL:', error);
      throw new Error(`Multipart URL generation failed: ${error.message}`);
    }
  }

  /**
   * Crear upload multiparte manual para archivos muy grandes
   */
  static async _createMultipartUpload(documentId, key, fileType, metadata = {}) {
    try {
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        ContentType: fileType,
        Metadata: {
          'document-id': documentId,
          'uploaded-at': new Date().toISOString(),
          'upload-type': 'manual-multipart',
          ...metadata
        },
      });

      const multipartUpload = await s3Client.send(createCommand);

      return {
        success: true,
        uploadType: 'manual-multipart',
        uploadId: multipartUpload.UploadId,
        key: multipartUpload.Key,
        publicUrl: `${R2_CONFIG.publicUrl}/${key}`,
        instructions: 'Use uploadId and key to upload parts individually'
      };
    } catch (error) {
      console.error('Error creating multipart upload:', error);
      throw new Error(`Multipart upload creation failed: ${error.message}`);
    }
  }

  /**
   * Generar URL firmada para subir una parte específica
   */
  static async generatePartUploadURL(uploadId, key, partNumber, expiresIn = 3600) {
    try {
      const command = new UploadPartCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { 
        expiresIn 
      });

      return {
        success: true,
        signedUrl,
        uploadId,
        key,
        partNumber,
        expiresIn
      };
    } catch (error) {
      console.error('Error generating part upload URL:', error);
      throw new Error(`Part URL generation failed: ${error.message}`);
    }
  }

  /**
   * Completar upload multiparte manual
   */
  static async completeMultipartUpload(uploadId, key, parts) {
    try {
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts,
        },
      });

      const result = await s3Client.send(completeCommand);

      return {
        success: true,
        url: `${R2_CONFIG.publicUrl}/${key}`,
        key,
        etag: result.ETag,
        location: result.Location
      };
    } catch (error) {
      console.error('Error completing multipart upload:', error);
      
      // Intentar abortar en caso de error
      await this.abortMultipartUpload(uploadId, key);
      
      throw new Error(`Multipart upload completion failed: ${error.message}`);
    }
  }

  /**
   * Abortar upload multiparte
   */
  static async abortMultipartUpload(uploadId, key) {
    try {
      const abortCommand = new AbortMultipartUploadCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        UploadId: uploadId,
      });

      await s3Client.send(abortCommand);

      return {
        success: true,
        message: 'Multipart upload aborted successfully'
      };
    } catch (error) {
      console.error('Error aborting multipart upload:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generar URL firmada para subida directa (hasta 100MB)
   */
 static async generateUploadURL(documentId, fileType, options = {}) {
    try {
      const { prefix = 'documents', expiresIn = 3600, metadata = {} } = options;
      const fileExtension = fileType.split('/')[1] || 'bin';
      const key = `${prefix}/${documentId}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        ContentType: fileType,
        Metadata: {
          'document-id': documentId,
          'uploaded-at': new Date().toISOString(),
          ...metadata
        },
      });

      const signedUrl = await getSignedUrl(s3Client, command, { 
        expiresIn 
      });

      return {
        success: true,
        signedUrl,
        publicUrl: `${R2_CONFIG.publicUrl}/${key}`,
        key,
        expiresIn
      };
    } catch (error) {
      console.error('Error generating upload URL:', error);
      throw new Error(`URL generation failed: ${error.message}`);
    }
  }


  // ... (mantener el resto de métodos: deleteDocument, generateDownloadURL, etc.)

  /**
   * Verificar tamaño máximo soportado
   */
  static getUploadLimits() {
    return {
      simpleUpload: '100MB',
      multipartUpload: '5TB',
      recommendedPartSize: '10MB-100MB',
      maxParts: 10000
    };
  }



  /**
   * Generar URL firmada para descarga
   */
  static async generateDownloadURL(fileKey, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileKey,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { 
        expiresIn 
      });

      return {
        success: true,
        signedUrl,
        expiresIn
      };
    } catch (error) {
      console.error('Error generating download URL:', error);
      throw new Error(`Download URL generation failed: ${error.message}`);
    }
  }

  /**
   * Eliminar documento
   */
  static async deleteDocument(fileUrlOrKey) {
    try {
      let key;
      
      if (fileUrlOrKey.startsWith('http')) {
        // Es una URL completa
        const urlParts = fileUrlOrKey.split('/');
        key = urlParts.slice(3).join('/'); // Remover dominio
      } else {
        // Es una key directa
        key = fileUrlOrKey;
      }

      const command = new DeleteObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key
      });

      await s3Client.send(command);
      
      return {
        success: true,
        deletedKey: key
      };
    } catch (error) {
      console.error('Error deleting from R2:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener metadatos del archivo
   */
  static async getFileMetadata(fileKey) {
    try {
      const command = new HeadObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileKey,
      });

      const metadata = await s3Client.send(command);

      return {
        success: true,
        metadata: {
          contentType: metadata.ContentType,
          contentLength: metadata.ContentLength,
          lastModified: metadata.LastModified,
          etag: metadata.ETag,
          metadata: metadata.Metadata,
          expires: metadata.Expires
        }
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Listar archivos en un prefijo
   */
  static async listFiles(prefix = 'documents', options = {}) {
    try {
      const { maxKeys = 100, continuationToken } = options;
      
      const command = new ListObjectsV2Command({
        Bucket: R2_CONFIG.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
      });

      const result = await s3Client.send(command);

      return {
        success: true,
        files: result.Contents?.map(file => ({
          key: file.Key,
          size: file.Size,
          lastModified: file.LastModified,
          etag: file.ETag,
          url: `${R2_CONFIG.publicUrl}/${file.Key}`
        })) || [],
        isTruncated: result.IsTruncated,
        nextContinuationToken: result.NextContinuationToken,
        keyCount: result.KeyCount
      };
    } catch (error) {
      console.error('Error listing files:', error);
      return {
        success: false,
        error: error.message,
        files: []
      };
    }
  }

  /**
   * Copiar archivo
   */
  static async copyFile(sourceKey, destinationKey, options = {}) {
    try {
      const command = new CopyObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        CopySource: `/${R2_CONFIG.bucketName}/${sourceKey}`,
        Key: destinationKey,
        MetadataDirective: options.metadataDirective || 'COPY',
        ...(options.newMetadata && { 
          Metadata: options.newMetadata,
          MetadataDirective: 'REPLACE'
        })
      });

      await s3Client.send(command);

      return {
        success: true,
        sourceKey,
        destinationKey,
        destinationUrl: `${R2_CONFIG.publicUrl}/${destinationKey}`
      };
    } catch (error) {
      console.error('Error copying file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verificar conexión con R2
   */
  static async healthCheck() {
    try {
      const result = await this.listFiles('', { maxKeys: 1 });
      return {
        success: result.success,
        bucket: R2_CONFIG.bucketName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        bucket: R2_CONFIG.bucketName,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Obtener estadísticas del bucket
   */
  static async getBucketStats(prefix = '') {
    try {
      let totalSize = 0;
      let totalFiles = 0;
      let continuationToken;
      
      do {
        const result = await this.listFiles(prefix, { 
          maxKeys: 1000, 
          continuationToken 
        });
        
        if (result.success && result.files) {
          totalFiles += result.files.length;
          totalSize += result.files.reduce((sum, file) => sum + (file.size || 0), 0);
          continuationToken = result.nextContinuationToken;
        } else {
          break;
        }
      } while (continuationToken);

      return {
        success: true,
        stats: {
          totalFiles,
          totalSize,
          totalSizeMB: Math.round(totalSize / (1024 * 1024)),
          prefix
        }
      };
    } catch (error) {
      console.error('Error getting bucket stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default R2Client;