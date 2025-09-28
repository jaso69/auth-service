// api/resend-code.js
import { AuthService } from '../lib/auth.js';
import { EmailService } from '../lib/email.js';

export default async function handler(req, res) {
  console.log('🔍 Resend-code endpoint llamado');
  
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email requerido' 
      });
    }

    // Generar nuevo código
    const result = await AuthService.resendVerificationCode(email);

    // Enviar email con nuevo código
    await EmailService.sendVerificationEmail(email, result.verificationCode, result.name);

    res.status(200).json({
      success: true,
      message: 'Código de verificación reenviado'
    });

  } catch (error) {
    console.error('❌ Error en resend-code:', error.message);
    res.status(400).json({ 
      success: false,
      error: error.message
    });
  }
}