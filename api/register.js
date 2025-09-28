import { AuthService } from '../lib/auth.js';
import { initDB } from '../lib/db.js';
import { EmailService } from '../lib/email.js';

// Inicializar DB una vez al cargar el módulo
let initializationPromise = null;

async function ensureDBInitialized() {
  if (!initializationPromise) {
    initializationPromise = initDB().catch(error => {
      console.error('❌ Error inicializando DB:', error);
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}

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

    // Asegurar que la DB esté inicializada
    await ensureDBInitialized();

    // Parsear body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password, name } = body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Usar el servicio de autenticación
    const result = await AuthService.register(email, password, { name });

    // 👇 CORREGIR: Usar el código que ya generó AuthService
    console.log('📧 Datos para email:', {
      email: email,
      verificationCode: result.verificationCode, // 👈 Este es el código correcto
      name: name
    });
    console.log('🔍 Resultado del registro:', {
      tieneUser: !!result.user,
      tieneToken: !!result.token,
      tieneVerificationCode: !!result.verificationCode,
      verificationCode: result.verificationCode
    });

    // 👇 Asegúrate de que esta parte se ejecuta
    console.log('📧 PREPARANDO envío de email...');


    // 👇 CORREGIR: Enviar el código correcto
    EmailService.sendVerificationEmail(email, result.verificationCode, name)
      .then(() => {
        console.log('✅ Email de verificación enviado exitosamente');
      })
      .catch(error => {
        console.error('❌ Error enviando email de verificación:', error);
        // No falla el registro si el email falla
      });
      console.log('📧 Email function llamada (continuando...)');
    // Cookie segura
    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `token=${result.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax; ${isProduction ? 'Secure;' : ''}`
    ]);

    console.log('✅ Registro exitoso para:', email);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente. Te hemos enviado un email con el código de verificación.',
      user: result.user,
      token: result.token,
      emailSent: true
    });

  } catch (error) {
    console.error('❌ Error en registro:', error.message);
    
    let statusCode = 400;
    if (error.message.includes('ya existe')) {
      statusCode = 409;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: error.message
    });
  }
}