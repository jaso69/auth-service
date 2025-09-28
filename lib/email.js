import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  static async sendVerificationEmail(email, verificationToken, userName = '') {
    try {
      const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;
      
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'Acme <onboarding@resend.dev>',
        to: [email],
        subject: 'Confirma tu correo electrónico',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #007bff; color: white; padding: 20px; text-align: center; }
              .content { background: #f9f9f9; padding: 30px; }
              .button { 
                display: inline-block; 
                background: #007bff; 
                color: white; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 5px; 
                margin: 20px 0;
              }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Bienvenido a nuestra plataforma</h1>
              </div>
              <div class="content">
                <h2>Hola ${userName || 'Usuario'},</h2>
                <p>Gracias por registrarte. Para completar tu registro, por favor ingresa el siguiente codigo: ${this.generarCodigoSeguro()}</p>
                
                <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Confirmar mi correo</a>
                </div>
                
                <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                <p><a href="${verificationUrl}">${verificationUrl}</a></p>
                
                <p><strong>Este enlace expirará en 24 horas.</strong></p>
                
                <p>Si no te registraste en nuestra plataforma, por favor ignora este mensaje.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} RPG Ingenieria. Todos los derechos reservados.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Bienvenido a nuestra plataforma

          Hola ${userName || 'Usuario'},

          Gracias por registrarte. Para completar tu registro, por favor confirma tu dirección de correo electrónico visitando el siguiente enlace:

          ${verificationUrl}

          Este enlace expirará en 24 horas.

          Si no te registraste en nuestra plataforma, por favor ignora este mensaje.

          Saludos,
          El equipo de Tu Empresa
        `
      });

      if (error) {
        console.error('❌ Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      console.log('✅ Email de verificación enviado a:', email);
      return data;

    } catch (error) {
      console.error('❌ Error en EmailService:', error);
      throw error;
    }
  }

  static async sendWelcomeEmail(email, userName = '') {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'Acme <onboarding@resend.dev>',
        to: [email],
        subject: '¡Bienvenido a nuestra plataforma!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007bff;">¡Bienvenido ${userName || 'Usuario'}!</h2>
            <p>Tu cuenta ha sido verificada exitosamente y ya puedes disfrutar de todos nuestros servicios.</p>
            <p>Estamos emocionados de tenerte con nosotros.</p>
            <br>
            <p>Saludos,<br>El equipo de Tu Empresa</p>
          </div>
        `
      });

      if (error) {
        console.error('❌ Error enviando email de bienvenida:', error);
        return;
      }

      console.log('✅ Email de bienvenida enviado a:', email);
      return data;

    } catch (error) {
      console.error('❌ Error enviando email de bienvenida:', error);
      // No lanzamos error para no afectar el flujo principal
    }
  }

  static async generarCodigoSeguro() {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] % 900000 + 100000).toString();
}


}