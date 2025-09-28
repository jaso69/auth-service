import { AuthService } from '../../lib/auth.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token de verificación requerido' });
    }

    // Verificar el token
    const user = await AuthService.verifyEmail(token);

    // Redirigir a página de éxito
    res.writeHead(302, {
      Location: '/email-verified?success=true'
    });
    res.end();

  } catch (error) {
    console.error('❌ Error verificando email:', error);
    
    // Redirigir a página de error
    res.writeHead(302, {
      Location: '/email-verified?success=false&error=' + encodeURIComponent(error.message)
    });
    res.end();
  }
}