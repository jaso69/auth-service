// api/debug-email.js
import { EmailService } from '../lib/email.js';

export default async function handler(req, res) {
  console.log('🧪 DEBUG EMAIL - Iniciando prueba...');
  
  try {
    console.log('🧪 Variables de entorno:', {
      tieneRESEND_API_KEY: !!process.env.RESEND_API_KEY,
      tieneFROM_EMAIL: !!process.env.FROM_EMAIL,
      NODE_ENV: process.env.NODE_ENV
    });

    console.log('🧪 Llamando a EmailService...');
    
    const result = await EmailService.sendVerificationEmail(
      'joseonieva@gmail.com', 
      '123456', 
      'Usuario Test'
    );
    
    console.log('🧪 EmailService completado:', result);
    
    res.json({
      success: true,
      message: 'Email de prueba enviado',
      result
    });
    
  } catch (error) {
    console.error('🧪 ERROR en debug-email:', error.message);
    console.error('🧪 Stack completo:', error.stack);
    
    res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}