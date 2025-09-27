import { AuthService } from '../lib/auth.js';
import { updateUserRole } from '../lib/db.js';

export default async function handler(req, res) {
    
    // Habilitar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejar preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }

        const user = await AuthService.verifyToken(token);
        
        if (!user) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        const updateRole = await updateUserRole(user.id, 'admin');

        res.status(200).json({ updateRole });

    } catch (error) {
        res.status(401).json({ error: error.message });
    }
}