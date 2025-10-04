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
      // 1. Generar URL firmada para descarga
      // En tu documents.js - REEMPLAZA el endpoint de descarga con esto:

// 👇 GET - Generar URL firmada para descarga
if (req.method === 'GET' && req.query.download && req.query.documentId) {
  const { documentId } = req.query;
  
  if (!documentId) {
    return res.status(400).json({ error: 'ID del documento requerido' });
  }

  try {
    console.log('🔍 Buscando documento para descarga:', documentId);
    
    // Obtener TODOS los documentos (usa tu función existente)
    const documents = await getAllDocuments();
    
    // Buscar el documento específico
    const doc = documents.find(d => d.id === documentId);
    
    if (!doc) {
      console.log('❌ Documento no encontrado:', documentId);
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    console.log('📁 Documento encontrado:', doc.name);
    console.log('🔗 file_url:', doc.file_url);
    console.log('📝 Tipo de file_url:', typeof doc.file_url);
    
    // Extraer la key del file_url
    const fileUrl = doc.file_url;
    
    // Verificar que file_url es un string
    if (typeof fileUrl !== 'string') {
      console.error('❌ file_url no es string:', fileUrl);
      return res.status(500).json({ error: 'Formato de URL inválido' });
    }
    
    // Extraer la key - manera robusta
    const key = fileUrl.replace(/https:\/\/pub-[^\/]+\/(.+)/, '$1');
    console.log('🔑 Key extraída:', key);
    console.log('🔧 Configuración R2:');
    console.log('🔧 Account ID:', process.env.CLOUDFLARE_ACCOUNT_ID);
    console.log('🔧 Bucket Name:', process.env.R2_BUCKET_NAME);
    console.log('🔧 Access Key ID:', process.env.R2_ACCESS_KEY_ID ? '✅ Presente' : '❌ Faltante');
    console.log('🔧 Secret Access Key:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Presente' : '❌ Faltante');
    // Generar URL firmada para descarga
    console.log('🔄 Generando URL firmada...');
    const downloadResult = await R2Client.generateDownloadURL(key);
    
    if (downloadResult.success) {
      console.log('✅ URL firmada generada correctamente');
      return res.json({
        success: true,
        signedUrl: downloadResult.signedUrl,
        expiresIn: downloadResult.expiresIn
      });
    } else {
      console.error('❌ Error generando URL firmada:', downloadResult.error);
      return res.status(500).json({ error: 'Error al generar URL de descarga: ' + downloadResult.error });
    }
    
  } catch (error) {
    console.error('❌ Error generating download URL:', error);
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
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

    // 👇 POST - Crear nuevo documento CON ARCHIVO
    if (req.method === 'POST') {
      const formData = await parseFormData(req);
      
      if (!formData.file) {
        return res.status(400).json({ error: 'Archivo requerido' });
      }

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

      try {
        // 1. Subir archivo a R2 - MANERA CORREGIDA
        console.log('📤 Subiendo archivo a R2...');
        const uploadResult = await R2Client.uploadDocument(formData.file, Date.now().toString());
        
        // DEBUG: Ver qué devuelve realmente uploadDocument
        console.log('📄 Resultado de uploadDocument:', uploadResult);
        console.log('📄 Tipo de resultado:', typeof uploadResult);
        
        // MANEJO ROBUSTO DEL RESULTADO
        let fileUrl;
        if (typeof uploadResult === 'string') {
          // Si devuelve directamente la URL string
          fileUrl = uploadResult;
        } else if (uploadResult && typeof uploadResult === 'object') {
          // Si devuelve un objeto con propiedad url
          fileUrl = uploadResult.url || uploadResult.fileUrl;
        } else {
          throw new Error('Resultado de uploadDocument no válido: ' + JSON.stringify(uploadResult));
        }
        
        // Validar que fileUrl es un string
        if (typeof fileUrl !== 'string') {
          throw new Error('URL del archivo no es un string: ' + typeof fileUrl);
        }
        
        console.log('✅ URL final para guardar en BD:', fileUrl);

        // 2. Crear documento en la base de datos
        const newDocument = await createDocument({
          ...documentData,
          file_name: formData.file.name,
          file_url: fileUrl, // ✅ GUARDAR STRING, NO OBJETO
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
        console.error('❌ Error subiendo a R2:', uploadError);
        return res.status(500).json({ error: 'Error al subir el archivo: ' + uploadError.message });
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

// Función para parsear FormData (sin cambios)
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
        const contentType = req.headers['content-type'];
        const boundary = contentType.split('boundary=')[1];
        
        if (!boundary) {
          reject(new Error('No boundary found in Content-Type'));
          return;
        }

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
                const filename = filenameMatch[1];
                result.file = {
                  name: filename,
                  type: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
                  size: Buffer.from(value).length,
                  buffer: Buffer.from(value)
                };
              } else {
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