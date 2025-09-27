import { AuthService } from '../lib/auth.js';
import { initDB } from '../lib/db.js';

// Inicializar DB una vez al cargar el módulo
let initializationPromise = null;

async function ensureDBInitialized() {
  if (!initializationPromise) {
    initializationPromise = initDB().catch(error => {
      console.error('❌ Error inicializando DB:', error);
      initializationPromise = null; // Permitir reintento
      throw error;
    });
  }
  return initializationPromise;
}

export default async function handler(req, res) {
  console.log('🔍 Login endpoint llamado');
  
  try {
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

    // Asegurar que la DB esté inicializada
    await ensureDBInitialized();

    // Parsear body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password } = body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Usar el servicio de autenticación
    const result = await AuthService.login(email, password);

    // Cookie segura
    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `token=${result.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax; ${isProduction ? 'Secure;' : ''}`
    ]);

    console.log('✅ Login exitoso para:', email);

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      user: result.user
      // No enviar el token en el JSON si ya está en la cookie
    });

  } catch (error) {
    console.error('❌ Error en login:', error.message);
    
    let statusCode = 401;
    if (error.message.includes('requeridos')) {
      statusCode = 400;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: error.message
    });
  }
}