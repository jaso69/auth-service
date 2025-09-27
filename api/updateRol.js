import { AuthService } from '../lib/auth.js';
import { updateUserRole } from '../lib/db.js';

export default async function handler(req, res) {
    // Headers CORS
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
        console.log('🔧 Endpoint updateRol llamado');
        
        // Extraer token
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        
        if (!token) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }
        
        // 🔥 Verificar usuario y extraer su ID del token
        const user = await AuthService.verifyAndExtractUser(token);
        console.log('Usuario autenticado:', user.email, '- Rol actual:', user.rol);
        
        // Parsear body - ahora solo necesita el rol
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { rol } = body;

        console.log('Nuevo rol solicitado:', rol);

        if (!rol) {
            return res.status(400).json({ error: 'Rol requerido' });
        }

        // Validar rol permitido
        const allowedRoles = ['guest', 'user', 'moderator', 'admin'];
        if (!allowedRoles.includes(rol)) {
            return res.status(400).json({ error: `Rol no válido` });
        }

        // 🔥 Usar el ID del usuario autenticado (del token)
        const userId = user.id;
        console.log(`🔄 Actualizando rol del usuario ${userId} a ${rol}`);
        
        // Actualizar rol
        const updatedUser = await updateUserRole(userId, rol);
        
        console.log('✅ Rol actualizado correctamente');
        
        res.status(200).json({ 
            success: true, 
            message: 'Rol actualizado correctamente',
            user: updatedUser 
        });

    } catch (error) {
        console.error('❌ Error en updateRol:', error.message);
        
        if (error.message.includes('Token inválido')) {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }
        
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}