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

    // Obtener token
    let token = req.cookies?.token || 
                (req.headers.authorization?.startsWith('Bearer ') 
                  ? req.headers.authorization.substring(7) 
                  : req.headers.authorization);

    console.log('🔑 Token recibido:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token de autenticación requerido' 
      });
    }

    // 👇 DEBUG EXTENDIDO
    console.log('🔧 Llamando a AuthService.verifyAndExtractUser...');
    const user = await AuthService.verifyAndExtractUser(token);
    console.log('✅ AuthService retornó:', user ? `usuario ${user.email}` : 'NULL');
    
    if (!user) {
      throw new Error('Usuario es null después de verifyAndExtractUser');
    }

    // Perfil simplificado - solo lo esencial
    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      rol: user.rol,
      isVerified: user.is_verified,  // ✅ Usar snake_case del objeto user
      createdAt: user.created_at     // ✅ Usar snake_case del objeto user
    };

    console.log('✅ Perfil enviado para:', user.email);

    res.status(200).json({
      success: true,
      message: 'Perfil obtenido correctamente',
      user: userProfile
    });

  } catch (error) {
    console.error('❌ Error COMPLETO en profile endpoint:', error);
    console.error('❌ Stack:', error.stack);
    
    res.status(401).json({ 
      success: false,
      error: 'Error de autenticación' 
    });
  }
}