import { AuthService } from '../lib/auth.js';

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
      console.log('🔑 Token obtenido de cookies');
    }
    // 2. Del header Authorization (si viene de API calls)
    else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Quitar "Bearer "
      } else {
        token = authHeader;
      }
      console.log('🔑 Token obtenido de Authorization header');
    }

    console.log('🔑 Token recibido:', token ? `${token.substring(0, 20)}...` : 'NO');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token de autenticación requerido' 
      });
    }

    // Usar AuthService para verificar el token
    const user = await AuthService.verifyAndExtractUser(token);
    
    console.log('✅ Usuario verificado:', user.email);

    // 👇 CORREGIR: Usar los nombres correctos de la base de datos
    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      rol: user.rol,
      createdAt: user.created_at,    // ✅ snake_case
      isVerified: user.is_verified   // ✅ snake_case
    };

    console.log('✅ Perfil enviado para:', user.email);

    res.status(200).json({
      success: true,
      message: 'Perfil obtenido correctamente',
      user: userProfile
    });

  } catch (error) {
    console.error('❌ Error en profile endpoint:', error.message);
    
    if (error.message.includes('Token inválido') || error.message.includes('jwt') || error.message.includes('Usuario no encontrado')) {
      return res.status(401).json({ 
        success: false,
        error: 'Token inválido o expirado' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor' 
    });
  }
}