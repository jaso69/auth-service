import { AuthService } from '../lib/auth.js';
import { updateUserRole, initDB } from '../lib/db.js';

// Inicializar DB una vez al cargar el módulo
await initDB().catch(console.error);

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
        const token = req.headers.authorization?.replace('Bearer ', '') || 
                     req.cookies?.token;
        
        console.log('🔐 Endpoint updateRol llamado');
        
        if (!token) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }
        
        // Verificar usuario
        const user = await AuthService.verifyAndExtractUser(token);
        console.log('👤 Usuario autenticado:', user.email);
        
        // Validar que el usuario tenga permisos para cambiar roles
        if (user.rol !== 'admin') {
            return res.status(403).json({ error: 'No tienes permisos para cambiar roles' });
        }

        // Parsear body
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { userId, newRol } = body;

        if (!userId || !newRol) {
            return res.status(400).json({ error: 'userId y newRol son requeridos' });
        }

        // Validar rol permitido
        const allowedRoles = ['guest', 'user', 'moderator', 'admin'];
        if (!allowedRoles.includes(newRol)) {
            return res.status(400).json({ error: 'Rol no válido' });
        }

        console.log(`🔄 Actualizando rol de usuario ${userId} a ${newRol}`);
        
        // Actualizar rol
        const updatedUser = await updateUserRole(userId, newRol);
        
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
        
        if (error.message.includes('no encontrado')) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}