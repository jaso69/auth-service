// api/documents.js - VERSIÓN COMPLETA CON SUBIDA DE ARCHIVOS
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

// Para Vercel, necesitamos un enfoque diferente para FormData
export const config = {
  api: {
    bodyParser: false, // Desactivar el bodyParser por defecto
  },
};

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verificar autenticación
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const user = await AuthService.verifyAndExtractUser(token);
    if (!user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Asegurar que la tabla existe
    await initDocumentsTable();

    // 👇 GET - Obtener todos los documentos
    if (req.method === 'GET') {
      const { search } = req.query;
      
      if (search) {
        const documents = await searchDocuments(search);
        return res.json({ success: true, documents });
      } else {
        const documents = await getAllDocuments();
        return res.json({ success: true, documents });
      }
    }

    // En api/documents.js - Añade este endpoint
  if (req.method === 'GET' && req.query.download) {
      const { key } = req.query;
      
      if (!key) {
          return res.status(400).json({ error: 'Key del archivo requerida' });
      }

      try {
          const downloadResult = await R2Client.generateDownloadURL(key);
          
          if (downloadResult.success) {
              // Redirigir directamente a la URL firmada
              res.redirect(downloadResult.signedUrl);
          } else {
              res.status(500).json({ error: 'Error generando URL de descarga' });
          }
      } catch (error) {
          console.error('Error generating download URL:', error);
          res.status(500).json({ error: error.message });
      }
  }

    // 👇 POST - Crear nuevo documento CON ARCHIVO
    if (req.method === 'POST') {
      // Manejar FormData manualmente
      const formData = await parseFormData(req);
      
      if (!formData.file) {
        return res.status(400).json({ error: 'Archivo requerido' });
      }

      // Parsear los datos del documento
      let documentData;
      try {
        documentData = JSON.parse(formData.document);
      } catch (error) {
        return res.status(400).json({ error: 'Formato de datos inválido' });
      }

      // Validaciones básicas
      if (!documentData.name || !documentData.brand || !documentData.model) {
        return res.status(400).json({ error: 'Nombre, marca y modelo son obligatorios' });
      }

      // Validar tipo de archivo
      const allowedTypes = ['application/pdf', 'application/msword', 
                           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(formData.file.type)) {
        return res.status(400).json({ error: 'Tipo de archivo no permitido. Solo PDF, DOC y DOCX.' });
      }

      // Validar tamaño (250MB máximo)
      if (formData.file.size > 250 * 1024 * 1024) {
        return res.status(400).json({ error: 'Archivo demasiado grande (máximo 250MB)' });
      }

      try {
        // 1. Subir archivo a R2
        const fileUrl = await R2Client.uploadDocument(formData.file, Date.now().toString());
        const url = fileUrl.url

        // 2. Crear documento en la base de datos
        const newDocument = await createDocument({
          ...documentData,
          file_name: formData.file.name,
          file_url: url,
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
        console.error('Error subiendo a R2:', uploadError);
        return res.status(500).json({ error: 'Error al subir el archivo: ' + uploadError.message });
      }
    }

    // 👇 PUT - Actualizar documento (solo metadata, sin archivo)
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

// Función para parsear FormData en Vercel
async function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let body = '';

    req.on('data', chunk => {
      chunks.push(chunk);
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        // Parsear el boundary del Content-Type
        const contentType = req.headers['content-type'];
        const boundary = contentType.split('boundary=')[1];
        
        if (!boundary) {
          reject(new Error('No boundary found in Content-Type'));
          return;
        }

        // Parsear manualmente el FormData
        const parts = body.split(`--${boundary}`);
        const result = {};

        for (const part of parts) {
          if (part.includes('Content-Disposition')) {
            const nameMatch = part.match(/name="([^"]+)"/);
            const filenameMatch = part.match(/filename="([^"]+)"/);
            const contentTypeMatch = part.match(/Content-Type:\s*([^\r\n]+)/);

            if (nameMatch) {
              const name = nameMatch[1];
              const value = part.split('\r\n\r\n')[1]?.split('\r\n--')[0]?.trim();

              if (filenameMatch) {
                // Es un archivo
                const filename = filenameMatch[1];
                result.file = {
                  name: filename,
                  type: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
                  size: Buffer.from(value).length,
                  buffer: Buffer.from(value)
                };
              } else {
                // Es un campo normal
                result[name] = value;
              }
            }
          }
        }

        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

