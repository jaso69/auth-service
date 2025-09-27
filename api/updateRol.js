import { AuthService } from '../lib/auth.js';
import { updateUserRole } from '../lib/db.js';

export default async function handler(req, res) {
    // 🔥 CORREGIR: Headers CORS más completos
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight por 24 horas
    
    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
        console.log('🔄 Preflight OPTIONS recibido');
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    
    try {
        console.log('🔧 Endpoint updateRol llamado');
        
        // 🔥 EXTRAER TOKEN CORRECTAMENTE
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        
        console.log('Token recibido:', token ? '✓' : '✗');
        
        if (!token) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }
        
        // Verificar usuario
        const user = await AuthService.verifyAndExtractUser(token);
        console.log('Usuario autenticado:', user.email, '- Rol:', user.rol);
        
        // 🔥 VALIDAR PERMISOS - Solo admin puede cambiar roles
        if (user.rol !== 'admin') {
            return res.status(403).json({ error: 'No tienes permisos para cambiar roles. Se requiere rol admin.' });
        }

        // Parsear body
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { userId, rol } = body;

        console.log('Datos recibidos:', { userId, rol });

        if (!userId || !rol) {
            return res.status(400).json({ 
                error: 'Datos incompletos. Se requiere userId y rol' 
            });
        }

        // Validar rol permitido
        const allowedRoles = ['guest', 'user', 'moderator', 'admin'];
        if (!allowedRoles.includes(rol)) {
            return res.status(400).json({ 
                error: `Rol no válido. Roles permitidos: ${allowedRoles.join(', ')}` 
            });
        }

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
        
        if (error.message.includes('no encontrado')) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        if (error.message.includes('única')) {
            return res.status(409).json({ error: 'Violación de constraint única' });
        }
        
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}