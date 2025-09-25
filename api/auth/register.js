import { AuthService } from '../../lib/auth.js';

export default async function handler(req, res) {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { email, password, name } = req.body;

        const result = await AuthService.register(email, password, { name });

        // Cookie segura
        res.setHeader('Set-Cookie', [
            `token=${result.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict; Secure=${process.env.NODE_ENV === 'production'}`
        ]);

        res.status(201).json({
            success: true,
            user: result.user,
            message: 'Usuario registrado correctamente'
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(400).json({ 
            error: error.message 
        });
    }
}