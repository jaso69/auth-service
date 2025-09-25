import { AuthService } from '../lib/auth.js';
import { initDB } from '../lib/db.js';

let dbInitialized = false;

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

    // Inicializar DB si no está inicializada
    if (!dbInitialized) {
      await initDB();
      dbInitialized = true;
    }

    // Parsear body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password } = body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Usar el servicio de autenticación
    const result = await AuthService.login(email, password);

    // Cookie segura
    res.setHeader('Set-Cookie', [
      `token=${result.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict; Secure=${process.env.NODE_ENV === 'production'}`
    ]);

    console.log('✅ Login exitoso para:', email);

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      user: result.user,
      token: result.token // Para que lo veas en la respuesta
    });

  } catch (error) {
    console.error('❌ Error en login:', error.message);
    
    res.status(401).json({ 
      success: false,
      error: error.message
    });
  }
}