import { AuthService } from '../lib/auth.js';
import { getAllComunidades, getComunidadByNumero } from '../lib/db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Manejar preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    // Verificar token y obtener usuario
    const user = await AuthService.verifyAndExtractUser(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar que el usuario esté verificado
    if (!user.is_verified) {
      return res.status(403).json({ 
        error: 'Cuenta no verificada',
        message: 'Por favor verifica tu email antes de acceder a los recursos' 
      });
    }

    // Obtener parámetros de query
    const { numero } = req.query;

    let comunidades;

    // Si se especifica un número, buscar esa comunidad específica
    if (numero) {
      const comunidad = await getComunidadByNumero(parseInt(numero));
      comunidades = comunidad ? [comunidad] : [];
    } else {
      // Si no, obtener todas las comunidades
      comunidades = await getAllComunidades();
    }
    
    res.status(200).json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        rol: user.rol
      },
      comunidades,
      count: comunidades.length
    });

  } catch (error) {
    console.error('❌ Error en endpoint /api/comunidades:', error);
    
    if (error.message.includes('Token') || error.message.includes('no proporcionado') || error.message.includes('inválido')) {
      return res.status(401).json({ 
        error: 'No autorizado',
        message: error.message 
      });
    }

    if (error.message.includes('verifica tu email')) {
      return res.status(403).json({ 
        error: 'Cuenta no verificada',
        message: error.message 
      });
    }

    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
}