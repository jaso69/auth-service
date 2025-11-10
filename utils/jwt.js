
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET no está definida');
  throw new Error('JWT_SECRET no configurada');
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  });
}

export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('❌ Error en verifyToken:', error.message);
    throw error; // Propaga el error para que AuthService lo maneje
  }
}