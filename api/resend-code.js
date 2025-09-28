// api/resend-code.js
import { AuthService } from '../lib/auth.js';
import { EmailService } from '../lib/email.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { email } = req.body;
    
    try {
      const result = await AuthService.resendVerificationCode(email);
      await EmailService.sendVerificationEmail(email, result.verificationCode, result.name);
      
      res.json({ success: true, message: 'Código reenviado' });
    } catch (error) {
      res.json({ success: false, error: error.message });
    }
  }
}