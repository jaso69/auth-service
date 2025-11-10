import { AuthService } from '../lib/auth.js';
import { updateUserRole, findUserByEmail } from '../lib/db.js';

export default async function handler(req, res) {
    // Headers CORS más permisivos para debugging
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    
    try {
        // Extraer token de múltiples formas
        let token = null;
        const authHeader = req.headers.authorization;
        
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (authHeader) {
            token = authHeader; // Por si acaso viene sin 'Bearer '
        }
        
        if (!token) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }

        // Verificar usuario
        const user = await AuthService.verifyAndExtractUser(token);
        
        // Parsear body
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { rol, email } = body;

        if (!rol) {
            return res.status(400).json({ error: 'Rol requerido' });
        }

        // Validar rol permitido
        const allowedRoles = ['guest', 'user', 'moderator', 'admin'];
        if (!allowedRoles.includes(rol)) {
            return res.status(400).json({ error: `Rol no válido` });
        }

        if (!email){
            return res.status(400).json({ error: 'Email requerido' });
        }

        const userToUpdate = await findUserByEmail(email);
        if (!userToUpdate) {
            return res.status(404).json({ error: 'Usuario a actualizar no encontrado' });
        }

        // Usar el ID del usuario autenticado
        const userId = userToUpdate.id;
        
        // Actualizar rol
        const updatedUser = await updateUserRole(userId, rol);
        
        res.status(200).json({ 
            success: true, 
            message: 'Rol actualizado correctamente',
            user: updatedUser 
        });

    } catch (error) {
        console.error('❌ Error en updateRol:', error.message);
        console.error('🔍 Stack trace:', error.stack);
        
        if (error.message.includes('Token inválido') || error.message.includes('jwt')) {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }
        
        if (error.message.includes('no encontrado')) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}