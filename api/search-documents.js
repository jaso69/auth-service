// api/search-documents.js
import { getAllDocuments } from '../lib/db.js';
import { verifyToken } from '../utils/auth.js';
import { DeepSeekClient } from '../lib/deepseek.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
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

    const { query } = req.body;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Término de búsqueda requerido (mínimo 2 caracteres)' });
    }

    // Obtener documentos de la base de datos
    const availableDocuments = await getAllDocuments();
    
    // Buscar con IA
    const results = await DeepSeekClient.searchDocuments(query, availableDocuments);
    
    res.json({
      success: true,
      results: results.matches,
      suggestions: results.suggestions,
      totalDocuments: availableDocuments.length
    });

  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}