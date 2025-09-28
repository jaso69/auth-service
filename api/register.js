import { AuthService } from '../lib/auth.js';
import { initDB } from '../lib/db.js';
import { EmailService } from '../lib/email.js';

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

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    await ensureDBInitialized();

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password, name } = body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const result = await AuthService.register(email, password, { name });

    console.log('🔍 DEBUG - verificationCode:', result.verificationCode);

    let emailSent = false;
    if (result.verificationCode) {
      console.log('📧 INICIANDO envío de email...');
      try {
        await EmailService.sendVerificationEmail(email, result.verificationCode, name);
        console.log('✅ Email de verificación enviado exitosamente');
        emailSent = true;
      } catch (error) {
        console.error('❌ Error CRÍTICO enviando email:', error.message);
        emailSent = false;
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `token=${result.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax; ${isProduction ? 'Secure;' : ''}`
    ]);

    console.log('✅ Registro completado. Email enviado:', emailSent);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      user: result.user,
      token: result.token,
      emailSent: emailSent,
      email: email 
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