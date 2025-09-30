// api/documents.js
import { 
  getAllDocuments, 
  createDocument, 
  updateDocument, 
  deleteDocument,
  searchDocuments,
  initDocumentsTable 
} from '../lib/db.js';
import { verifyToken } from '../utils/auth.js';

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

    const user = await verifyToken(token);
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

    // 👇 POST - Crear nuevo documento
    if (req.method === 'POST') {
      const documentData = {
        ...req.body,
        uploaded_by: user.id // Asignar el usuario que sube el documento
      };

      // Validaciones básicas
      if (!documentData.name || !documentData.brand || !documentData.model) {
        return res.status(400).json({ error: 'Nombre, marca y modelo son obligatorios' });
      }

      const newDocument = await createDocument(documentData);
      return res.status(201).json({ success: true, document: newDocument });
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