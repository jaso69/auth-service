import { AuthService } from '../../lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { email, password } = req.body;

        const result = await AuthService.login(email, password);

        res.setHeader('Set-Cookie', [
            `token=${result.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict; Secure=${process.env.NODE_ENV === 'production'}`
        ]);

        res.status(200).json({
            success: true,
            user: result.user,
            message: 'Login exitoso'
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(401).json({ 
            error: error.message 
        });
    }
}