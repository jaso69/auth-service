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

    // 👇 POST - Crear nuevo documento CON ARCHIVO
   if (req.method === 'POST') {
  console.log('📤 POST request received');
  
  // Usar parseFormData corregido que mantiene buffers
  const formData = await parseFormData(req);
  
  if (!formData.file) {
    return res.status(400).json({ error: 'Archivo requerido' });
  }

  // Verificar que tenemos un buffer válido
  if (!Buffer.isBuffer(formData.file.buffer)) {
    console.error('❌ El archivo no tiene un buffer válido');
    return res.status(400).json({ error: 'Archivo corrupto o inválido' });
  }

  console.log('📄 File received:', {
    name: formData.file.name,
    type: formData.file.type,
    size: formData.file.size,
    bufferSize: formData.file.buffer.length,
    isBuffer: Buffer.isBuffer(formData.file.buffer)
  });

  // Para PDFs, verificar integridad
  if (formData.file.type === 'application/pdf') {
    const pdfHeader = formData.file.buffer.slice(0, 4).toString('ascii');
    console.log('PDF Header check:', pdfHeader);
    if (pdfHeader !== '%PDF') {
      console.warn('⚠️ El archivo no parece ser un PDF válido');
    }
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

  const allowedTypes = [
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (!allowedTypes.includes(formData.file.type)) {
    return res.status(400).json({ error: 'Tipo de archivo no permitido. Solo PDF, DOC y DOCX.' });
  }

  if (formData.file.size > 250 * 1024 * 1024) {
    return res.status(400).json({ error: 'Archivo demasiado grande (máximo 250MB)' });
  }

  try {
    // Subir archivo a R2 con el buffer preservado
    console.log('🔤 Uploading to R2...');
    const fileUrl = await R2Client.uploadDocument(formData.file, Date.now().toString());
    
    console.log('✅ File uploaded successfully:', fileUrl);

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

    req.on('data', chunk => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        // Concatenar todos los chunks en un solo Buffer
        const buffer = Buffer.concat(chunks);
        
        const contentType = req.headers['content-type'];
        const boundary = contentType.split('boundary=')[1];
        
        if (!boundary) {
          reject(new Error('No boundary found in Content-Type'));
          return;
        }

        // Trabajar directamente con el Buffer
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const parts = splitBuffer(buffer, boundaryBuffer);
        const result = {};

        for (const part of parts) {
          // Buscar Content-Disposition en el buffer
          const headerEndIndex = findSequence(part, Buffer.from('\r\n\r\n'));
          
          if (headerEndIndex === -1) continue;
          
          // Extraer headers como string (esto sí es texto)
          const headers = part.slice(0, headerEndIndex).toString('utf-8');
          
          if (headers.includes('Content-Disposition')) {
            const nameMatch = headers.match(/name="([^"]+)"/);
            const filenameMatch = headers.match(/filename="([^"]+)"/);
            const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/);

            if (nameMatch) {
              const name = nameMatch[1];
              
              // El contenido empieza después de \r\n\r\n
              const contentStart = headerEndIndex + 4;
              
              // Buscar el final del contenido (antes del próximo boundary o final)
              let contentEnd = part.length;
              const endSequence = Buffer.from('\r\n--');
              const endIndex = findSequence(part, endSequence, contentStart);
              if (endIndex !== -1) {
                contentEnd = endIndex;
              }
              
              // Extraer el contenido como Buffer
              const content = part.slice(contentStart, contentEnd);

              if (filenameMatch) {
                // Es un archivo - mantener como Buffer
                const filename = filenameMatch[1];
                result.file = {
                  name: filename,
                  type: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
                  size: content.length,
                  buffer: content // ✅ Buffer sin corromper
                };
                
                console.log('📎 File parsed:', {
                  name: filename,
                  type: result.file.type,
                  bufferSize: content.length,
                  isBuffer: Buffer.isBuffer(content),
                  first10Bytes: content.slice(0, 10).toString('hex')
                });
              } else {
                // Es un campo de texto - convertir a string
                result[name] = content.toString('utf-8').trim();
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

// Función auxiliar para dividir un Buffer por un delimitador
function splitBuffer(buffer, delimiter) {
  const parts = [];
  let start = 0;
  let index;
  
  while ((index = findSequence(buffer, delimiter, start)) !== -1) {
    if (index > start) {
      parts.push(buffer.slice(start, index));
    }
    start = index + delimiter.length;
  }
  
  if (start < buffer.length) {
    parts.push(buffer.slice(start));
  }
  
  return parts;
}


// Función auxiliar para dividir un Buffer por un delimitador
function splitBuffer(buffer, delimiter) {
  const parts = [];
  let start = 0;
  let index;
  
  while ((index = findSequence(buffer, delimiter, start)) !== -1) {
    if (index > start) {
      parts.push(buffer.slice(start, index));
    }
    start = index + delimiter.length;
  }
  
  if (start < buffer.length) {
    parts.push(buffer.slice(start));
  }
  
  return parts;
}

// Función auxiliar para buscar una secuencia en un Buffer
function findSequence(buffer, sequence, start = 0) {
  for (let i = start; i <= buffer.length - sequence.length; i++) {
    let found = true;
    for (let j = 0; j < sequence.length; j++) {
      if (buffer[i + j] !== sequence[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}