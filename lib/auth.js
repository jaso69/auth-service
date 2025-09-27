import { createUser, findUserByEmail } from './db.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt.js';

export class AuthService {
  static async register(email, password, userData = {}) {
    console.log('🔧 Registrando usuario:', email);
    
    // Validaciones
    if (!email || !password) {
      throw new Error('Email y contraseña requeridos');
    }

    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    // Verificar si el usuario ya existe
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      throw new Error('Ya existe un usuario con este email');
    }

    // Hash seguro de contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Crear usuario en la base de datos
    const user = await createUser(email, passwordHash, userData.name);
    
    // Generar token JWT
    const token = generateToken({ 
      userId: user.id, 
      email: user.email 
    });
    
    return { 
      user: { 
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at
      }, 
      token 
    };
  }

    static async verifyAndExtractUser(token) {
    try {
      if (!token) {
        throw new Error('Token no proporcionado');
      }

      // Verificar y decodificar el token
      const decoded = verifyToken(token);
      
      // Buscar usuario en la base de datos para obtener datos actualizados
      const user = await findUserById(decoded.userId);
      
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        rol: user.rol,
        createdAt: user.created_at,
        iat: decoded.iat, // Fecha de emisión del token
        exp: decoded.exp  // Fecha de expiración del token
      };
    } catch (error) {
      throw new Error('Token inválido: ' + error.message);
    }
  }

  static async login(email, password) {
    console.log('🔧 Iniciando sesión para:', email);
    
    if (!email || !password) {
      throw new Error('Email y contraseña requeridos');
    }

    const user = await findUserByEmail(email);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Contraseña incorrecta');
    }

    const token = generateToken({ 
      userId: user.id, 
      email: user.email 
    });
    
    return { 
      user: { 
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at
      }, 
      token 
    };
  }
}