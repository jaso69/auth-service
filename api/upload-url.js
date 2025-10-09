// api/upload-url.js
import { AuthService } from '../lib/auth.js';
import { R2Client } from '../lib/r2-client.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
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

    const { fileType, documentId, prefix } = req.query;

    if (!fileType) {
      return res.status(400).json({ error: 'fileType es requerido' });
    }

    const id = documentId || `${user.id}-${Date.now()}`;

    const result = await R2Client.generateUploadURL(id, fileType, { prefix: prefix || 'documents' });
    if (!result?.success) {
      return res.status(500).json({ error: 'No se pudo generar la URL de subida' });
    }

    return res.status(200).json({
      success: true,
      signedUrl: result.signedUrl,
      publicUrl: result.publicUrl,
      key: result.key,
      expiresIn: result.expiresIn,
      documentId: id,
    });
  } catch (error) {
    console.error('Error en /api/upload-url:', error);
    return res.status(500).json({ error: error.message });
  }
}
