
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET no está definida');
  throw new Error('JWT_SECRET no configurada');
}

export function generateToken(payload) {
  console.log('🔧 Generando token con secret length:', JWT_SECRET?.length);
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  });
}

export function verifyToken(token) {
  try {
    console.log('🔧 Verificando token con secret length:', JWT_SECRET?.length);
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token verificado correctamente');
    return decoded;
  } catch (error) {
    console.error('❌ Error en verifyToken:', error.message);
    throw error; // Propaga el error para que AuthService lo maneje
  }
}