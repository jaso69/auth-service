// api/debug-token.js
import { AuthService } from '../lib/auth.js';

export default async function handler(req, res) {
  const token = req.query.token;
  
  if (!token) {
    return res.json({ error: 'Proporciona ?token=... en la URL' });
  }

  try {
    const user = await AuthService.verifyAndExtractUser(token);
    res.json({ success: true, user });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
}