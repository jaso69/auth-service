import { createUser, findUserByEmail, findUserById, updateUser } from './db.js';
import bcrypt from 'bcryptjs';
import { generateToken, verifyToken } from '../utils/jwt.js';

export class AuthService {
  static async register(email, password, userData = {}) {
    
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
    
    let rol = 'guest';
    if (email.includes('@jmfortiz.com')) {
      rol = 'admin';
    }
    
    // 👇 SOLO GENERAR CÓDIGO NUMÉRICO (6 dígitos)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // 👇 CREAR USUARIO CON CÓDIGO DE VERIFICACIÓN
    const user = await createUser(
      email, 
      passwordHash, 
      userData.name, 
      rol,
      verificationCode,        // 👈 Código de 6 dígitos
      verificationExpires      // 👈 Fecha de expiración
    );
    
    // Generar token JWT para sesión
    const token = generateToken({ 
      userId: user.id, 
      email: user.email 
    });
    
    return { 
      user: { 
        id: user.id,
        email: user.email,
        name: user.name,
        rol: user.rol,
        isVerified: user.is_verified,
        createdAt: user.created_at
      }, 
      token,
      verificationCode // 👈 IMPORTANTE: Retornar el código para el email
    };
  }

  // 👇 MÉTODO para verificar código
  static async verifyEmailCode(email, code) {
    
    if (!email || !code) {
      throw new Error('Email y código requeridos');
    }

    // Buscar usuario por email
    const user = await findUserByEmail(email);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (user.is_verified) {
      throw new Error('El usuario ya está verificado');
    }

    // Verificar código y expiración
    if (user.verification_token !== code) {
      throw new Error('Código de verificación incorrecto');
    }

    if (new Date() > new Date(user.verification_expires)) {
      throw new Error('El código ha expirado');
    }

    // Actualizar usuario como verificado
    await updateUser(user.id, {
      is_verified: true,
      verification_token: null,
      verification_expires: null
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isVerified: true
    };
  }

  // 👇 MÉTODO para reenviar código
  static async resendVerificationCode(email) {
    
    const user = await findUserByEmail(email);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (user.is_verified) {
      throw new Error('El usuario ya está verificado');
    }

    // Generar nuevo código
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Actualizar en la base de datos
    await updateUser(user.id, {
      verification_token: newVerificationCode,
      verification_expires: newVerificationExpires
    });

    return {
      verificationCode: newVerificationCode,
      email: user.email,
      name: user.name
    };
  }

 static async verifyAndExtractUser(token) {
  try {

    if (!token) {
      throw new Error('Token no proporcionado');
    }

    const decoded = verifyToken(token);
    
    const user = await findUserById(decoded.userId);
    
    if (!user) {
      console.error('❌ USUARIO NO ENCONTRADO. userId:', decoded.userId);
      throw new Error('Usuario no encontrado');
    }

    // 👇 CORREGIR: Retornar objeto con la estructura CORRECTA
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      rol: user.rol,
      is_verified: user.is_verified,  // ✅ snake_case
      created_at: user.created_at,    // ✅ snake_case
      iat: decoded.iat,
      exp: decoded.exp
    };

  } catch (error) {
    console.error('❌ Error en verifyAndExtractUser:', error.message);
    throw new Error('Token inválido: ' + error.message);
  }
}

  static async login(email, password) {
    
    if (!email || !password) {
      throw new Error('Email y contraseña requeridos');
    }

    const user = await findUserByEmail(email);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar si el email está confirmado
    if (!user.is_verified) {
      throw new Error('Por favor verifica tu email antes de iniciar sesión');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Contraseña incorrecta');
    }

    const token = generateToken({ 
      userId: user.id, 
      email: user.email,
      rol: user.rol 
    });
    
    return { 
      user: { 
        id: user.id,
        email: user.email,
        name: user.name,
        rol: user.rol,
        isVerified: user.is_verified,
        createdAt: user.created_at
      }, 
      token 
    };
  }
}