import { AuthService } from '../../lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
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

        res.status(200).json({ user });

    } catch (error) {
        res.status(401).json({ error: error.message });
    }
}