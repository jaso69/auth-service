import { AuthService } from '../lib/auth.js';
import { initDB } from '../lib/db.js';

// Inicializar DB al cargar (solo una vez)
let dbInitialized = false;

export default async function handler(req, res) {
  console.log('🔍 Register endpoint llamado');
  
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
    await initDB();
    if (!dbInitialized) {
      dbInitialized = true;
    }

    // Parsear body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password, name } = body;

    // Usar el servicio real de autenticación
    const result = await AuthService.register(email, password, { name });

    // Cookie segura
    res.setHeader('Set-Cookie', [
      `token=${result.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict; Secure=${process.env.NODE_ENV === 'production'}`
    ]);

    console.log('✅ Usuario registrado correctamente:', email);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado correctamente',
      user: result.user
    });

  } catch (error) {
    console.error('❌ Error en registro:', error.message);
    
    res.status(400).json({ 
      success: false,
      error: error.message
    });
  }
}