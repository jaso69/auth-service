import { verifyToken } from '../utils/jwt.js';
import { findUserById } from '../lib/db.js';

export default async function handler(req, res) {
  console.log('🔍 Profile endpoint llamado');
  
  try {
    // Habilitar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Manejar preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    // Obtener token de diferentes fuentes
    let token = null;
    
    // 1. De las cookies (si viene del navegador)
    if (req.cookies?.token) {
      token = req.cookies.token;
    }
    // 2. Del header Authorization (si viene de API calls)
    else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Quitar "Bearer "
      } else {
        token = authHeader;
      }
    }
    // 3. Del query string (para testing)
    else if (req.query?.token) {
      token = req.query.token;
    }

    console.log('🔑 Token recibido:', token ? 'SÍ' : 'NO');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token de autenticación requerido' 
      });
    }

    // Verificar token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ 
        success: false,
        error: 'Token inválido o expirado' 
      });
    }

    console.log('✅ Token válido para usuario:', decoded.userId);

    // Obtener usuario de la base de datos
    const user = await findUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Devolver información del perfil (sin datos sensibles)
    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      rol: user.rol,
      createdAt: user.created_at,
      // Puedes agregar más campos según necesites
      // lastLogin: user.last_login,
      // profileImage: user.profile_image,
    };

    console.log('✅ Perfil enviado para:', user.rol);

    res.status(200).json({
      success: true,
      message: 'Perfil obtenido correctamente',
      user: userProfile
    });

  } catch (error) {
    console.error('❌ Error en profile endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor' 
    });
  }
}