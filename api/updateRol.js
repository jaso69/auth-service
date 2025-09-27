import { AuthService } from '../lib/auth.js';
import { updateUserRole } from '../lib/db.js';

export default async function handler(req, res) {
    // Headers CORS más permisivos para debugging
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
        console.log('🔄 Preflight OPTIONS recibido');
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    
    try {
        console.log('🔧 Endpoint updateRol llamado');
        console.log('📨 Headers recibidos:', req.headers);
        
        // Extraer token de múltiples formas
        let token = null;
        const authHeader = req.headers.authorization;
        
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (authHeader) {
            token = authHeader; // Por si acaso viene sin 'Bearer '
        }
        
        console.log('🔐 Token recibido:', token ? `Sí (longitud: ${token.length})` : 'No');
        
        if (!token) {
            console.log('❌ Token no proporcionado en headers');
            return res.status(401).json({ error: 'Token no proporcionado' });
        }

        // Verificar usuario
        console.log('🔍 Verificando token...');
        const user = await AuthService.verifyAndExtractUser(token);
        console.log('✅ Usuario verificado:', user.email);
        
        // Parsear body
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { rol } = body;

        console.log('📝 Body recibido:', body);

        if (!rol) {
            return res.status(400).json({ error: 'Rol requerido' });
        }

        // Validar rol permitido
        const allowedRoles = ['guest', 'user', 'moderator', 'admin'];
        if (!allowedRoles.includes(rol)) {
            return res.status(400).json({ error: `Rol no válido` });
        }

        // Usar el ID del usuario autenticado
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