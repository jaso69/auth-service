// api/documents.js - VERSIÓN CORREGIDA
import { 
  getAllDocuments, 
  createDocument, 
  updateDocument, 
  deleteDocument,
  searchDocuments,
  initDocumentsTable 
} from '../lib/db.js';
import { AuthService } from '../lib/auth.js';
import { R2Client } from '../lib/r2-client.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const user = await AuthService.verifyAndExtractUser(token);
    if (!user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    await initDocumentsTable();

    // 👇 GET - Múltiples funcionalidades
    if (req.method === 'GET') {
  console.log('🎯 ENDPOINT GET EJECUTADO');
  console.log('🔗 URL completa:', req.url);
  console.log('❓ Query parameters:', req.query);
  
  // 1. Generar URL firmada para descarga
  if (req.query.download === 'true' && req.query.documentId) {
    const { documentId } = req.query;
    
    console.log('🚨 🚨 🚨 ENDPOINT DE DESCARGA DETECTADO 🚨 🚨 🚨');
    console.log('📋 documentId:', documentId);
    console.log('📋 download:', req.query.download);
    
    try {
      // Obtener TODOS los documentos
      console.log('📚 Obteniendo documentos...');
      const documents = await getAllDocuments();
      console.log('📚 Total documentos:', documents.length);
      
      // DEBUG: Mostrar todos los IDs
      console.log('🔍 IDs disponibles:');
      documents.forEach(doc => {
        console.log(`   - ${doc.id} : ${doc.name}`);
      });
      
      // Buscar el documento específico
      const doc = documents.find(d => d.id === documentId);
      
      if (!doc) {
        console.log('❌ Documento no encontrado con ID:', documentId);
        return res.status(404).json({ error: 'Documento no encontrado' });
      }

      console.log('✅ Documento encontrado:', doc.name);
      console.log('🔗 file_url:', doc.file_url);
      
      // Extraer la key del file_url
      const fileUrl = doc.file_url;
      const key = fileUrl.replace(/https:\/\/pub-[^\/]+\/(.+)/, '$1');
      console.log('🔑 Key extraída:', key);
      
      // Generar URL firmada para descarga
      console.log('🔄 Generando URL firmada...');
      const downloadResult = await R2Client.generateDownloadURL(key);
      console.log('📦 Resultado de generateDownloadURL:', downloadResult);
      
      if (downloadResult.success) {
        console.log('✅ URL firmada generada correctamente');
        return res.json({
          success: true,
          signedUrl: downloadResult.signedUrl,
          expiresIn: downloadResult.expiresIn
        });
      } else {
        console.error('❌ Error en generateDownloadURL:', downloadResult.error);
        return res.status(500).json({ error: 'Error al generar URL de descarga' });
      }
      
    } catch (error) {
      console.error('❌ Error en endpoint de descarga:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
      
      // 2. Búsqueda de documentos
      else if (req.query.search) {
        const { search } = req.query;
        const documents = await searchDocuments(search);
        return res.json({ success: true, documents });
      }
      
      // 3. Obtener todos los documentos
      else {
        const documents = await getAllDocuments();
        return res.json({ success: true, documents });
      }
    }

    // 👇 POST - Crear nuevo documento
    // Soporta dos flujos:
    // 1) application/json con file_url ya subido (presigned upload desde el cliente)
    // 2) multipart/form-data con archivo incluido (para uso local o sin Vercel)
    if (req.method === 'POST') {
      try {
        const contentType = req.headers['content-type'] || '';

        // 1) JSON: solo metadatos + file_url
        if (contentType.includes('application/json')) {
          const body = await readJsonBody(req);
          const { name, brand, model, file_url, file_name, file_size, file_type } = body || {};

          if (!name || !brand || !model) {
            return res.status(400).json({ error: 'Nombre, marca y modelo son obligatorios' });
          }
          if (!file_url) {
            return res.status(400).json({ error: 'file_url es obligatorio (sube el archivo con URL firmada primero)' });
          }

          const newDocument = await createDocument({
            name,
            brand,
            model,
            file_url,
            file_name: file_name || null,
            file_size: file_size || null,
            file_type: file_type || null,
            uploaded_by: user.id
          });

          return res.status(201).json({
            success: true,
            document: newDocument,
            message: 'Documento registrado correctamente (presigned upload)'
          });
        }

        // 2) multipart/form-data: incluye archivo (no apto para Vercel en archivos grandes)
        const formData = await parseFormData(req);
        
        if (!formData.file) {
          return res.status(400).json({ error: 'Archivo requerido' });
        }

        console.log('📁 Archivo recibido:', {
          name: formData.file.name,
          type: formData.file.type,
          size: formData.file.size
        });

        let documentData;
        try {
          documentData = JSON.parse(formData.document);
        } catch (error) {
          return res.status(400).json({ error: 'Formato de datos inválido' });
        }

        if (!documentData.name || !documentData.brand || !documentData.model) {
          return res.status(400).json({ error: 'Nombre, marca y modelo son obligatorios' });
        }

        const allowedTypes = ['application/pdf', 'application/msword', 
                             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(formData.file.type)) {
          return res.status(400).json({ error: 'Tipo de archivo no permitido. Solo PDF, DOC y DOCX.' });
        }

        if (formData.file.size > 250 * 1024 * 1024) {
          return res.status(400).json({ error: 'Archivo demasiado grande (máximo 250MB)' });
        }

        // Preparar el archivo para R2Client (agregar propiedades necesarias)
        const fileForUpload = {
          name: formData.file.name,
          buffer: formData.file.buffer,
          size: formData.file.size,
          mimetype: formData.file.type
        };

        // Subir archivo a R2
        console.log('📤 Subiendo archivo a R2...');
        const fileUrl = await R2Client.uploadDocument(fileForUpload, Date.now().toString());
        
        console.log('✅ URL recibida de R2:', fileUrl);
        console.log('✅ Tipo de URL:', typeof fileUrl);
        
        if (typeof fileUrl !== 'string') {
          throw new Error('uploadDocument no devolvió una URL válida');
        }
        
        // Crear documento en la base de datos
        const newDocument = await createDocument({
          ...documentData,
          file_name: formData.file.name,
          file_url: fileUrl,
          file_size: formData.file.size,
          file_type: formData.file.type,
          uploaded_by: user.id
        });

        return res.status(201).json({ 
          success: true, 
          document: newDocument,
          message: 'Documento subido exitosamente a Cloudflare R2'
        });

      } catch (uploadError) {
        console.error('❌ Error en POST /documents:', uploadError);
        return res.status(500).json({ 
          error: 'Error al subir el archivo', 
          details: uploadError.message 
        });
      }
    }

    // 👇 PUT - Actualizar documento
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID del documento requerido' });
      }

      const updatedDocument = await updateDocument(id, updates);
      return res.json({ success: true, document: updatedDocument });
    }

    // 👇 DELETE - Eliminar documento
    if (req.method === 'DELETE') {
      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID del documento requerido' });
      }

      const deletedDocument = await deleteDocument(id);
      return res.json({ success: true, message: `Documento "${deletedDocument.name}" eliminado` });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('Error en endpoint documents:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Función para parsear FormData
async function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', chunk => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'];
        
        if (!contentType || !contentType.includes('multipart/form-data')) {
          reject(new Error('Content-Type debe ser multipart/form-data'));
          return;
        }

        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) {
          reject(new Error('No se encontró boundary en Content-Type'));
          return;
        }

        const boundary = boundaryMatch[1];
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const result = {};

        // Dividir el buffer por el boundary
        let position = 0;
        const parts = [];
        
        while (position < buffer.length) {
          const boundaryIndex = buffer.indexOf(boundaryBuffer, position);
          if (boundaryIndex === -1) break;
          
          const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
          if (nextBoundaryIndex === -1) break;
          
          parts.push(buffer.slice(boundaryIndex + boundaryBuffer.length, nextBoundaryIndex));
          position = nextBoundaryIndex;
        }

        // Procesar cada parte
        for (const part of parts) {
          const headerEndIndex = part.indexOf(Buffer.from('\r\n\r\n'));
          if (headerEndIndex === -1) continue;

          const headers = part.slice(0, headerEndIndex).toString();
          const content = part.slice(headerEndIndex + 4, part.length - 2); // -2 para quitar \r\n final

          const nameMatch = headers.match(/name="([^"]+)"/);
          const filenameMatch = headers.match(/filename="([^"]+)"/);
          const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/);

          if (nameMatch) {
            const name = nameMatch[1];

            if (filenameMatch) {
              // Es un archivo
              result.file = {
                name: filenameMatch[1],
                type: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
                size: content.length,
                buffer: content
              };
            } else {
              // Es un campo de texto
              result[name] = content.toString('utf8');
            }
          }
        }

        resolve(result);
      } catch (error) {
        console.error('❌ Error parseando FormData:', error);
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

// Función para leer el cuerpo JSON de la petición
async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    req.on('data', chunk => {
      chunks.push(chunk);
    });
    
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        if (!body.trim()) {
          resolve({});
          return;
        }
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (error) {
        console.error('❌ Error parseando JSON:', error);
        reject(new Error('Formato JSON inválido'));
      }
    });
    
    req.on('error', reject);
  });
}