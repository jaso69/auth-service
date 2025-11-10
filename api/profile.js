import { AuthService } from '../lib/auth.js';

export default async function handler(req, res) {
  
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

    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token de autenticación requerido' 
      });
    }

    // 👇 DEBUG EXTENDIDO
    const user = await AuthService.verifyAndExtractUser(token);
    
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

    res.status(200).json({
      success: true,
      message: 'Perfil obtenido correctamente',
      user: userProfile
    });

  } catch (error) {
    
    res.status(401).json({ 
      success: false,
      error: 'Error de autenticación' 
    });
  }
}