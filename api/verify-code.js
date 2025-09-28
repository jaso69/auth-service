// api/verify-code.js
import { AuthService } from '../lib/auth.js';

export default async function handler(req, res) {
  console.log('🔍 Verify-code endpoint llamado');
  
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

    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ 
        success: false,
        error: 'Email y código requeridos' 
      });
    }

    // Verificar el código
    const user = await AuthService.verifyEmailCode(email, code);

    res.status(200).json({
      success: true,
      message: 'Email verificado exitosamente',
      user
    });

  } catch (error) {
    console.error('❌ Error en verify-code:', error.message);
    
    let statusCode = 400;
    if (error.message.includes('incorrecto')) {
      statusCode = 401;
    } else if (error.message.includes('expirado')) {
      statusCode = 410;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: error.message
    });
  }
}