import { createUser, findUserByEmail, findUserById, updateUser } from './db.js';
import bcrypt from 'bcryptjs';
import { generateToken, verifyToken } from '../utils/jwt.js';
import crypto from 'crypto'; // 👈 Necesario para generar tokens seguros

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
    
    let rol = 'guest';
    if (email.includes('@rpg.es')) {
      rol = 'admin';
    }
    
    // 👇 GENERAR CÓDIGO NUMÉRICO en lugar de token
   const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
    // 👇 GENERAR TOKEN DE VERIFICACIÓN
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // 👇 CREAR USUARIO CON VERIFICACIÓN
    const user = await createUser(
      email, 
      passwordHash, 
      userData.name, 
      rol,
      verificationCode,        // 👈 Nuevo campo
      verificationExpires       // 👈 Nuevo campo
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
        isVerified: user.is_verified, // 👈 Nuevo campo
        createdAt: user.created_at
      }, 
      token,
      verificationCode // 👈 IMPORTANTE: Para enviar por email
    };
  }

  // 👇 NUEVO MÉTODO para verificar código
static async verifyEmailCode(email, code) {
  console.log('🔧 Verificando código para:', email);
  
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

  console.log('✅ Email verificado para:', user.email);
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isVerified: true
  };
}

// 👇 NUEVO MÉTODO para reenviar código
static async resendVerificationCode(email) {
  console.log('🔧 Reenviando código a:', email);
  
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

  // 👇 NUEVO MÉTODO PARA VERIFICAR EMAIL
  static async verifyEmail(verificationToken) {
    console.log('🔧 Verificando email con token:', verificationToken);
    
    if (!verificationToken) {
      throw new Error('Token de verificación requerido');
    }

    // Buscar usuario por token de verificación
    const user = await findUserByVerificationToken(verificationToken);
    
    if (!user) {
      throw new Error('Token de verificación inválido');
    }

    // Verificar si el token ha expirado
    if (new Date() > new Date(user.verification_expires)) {
      throw new Error('El token de verificación ha expirado');
    }

    // Actualizar usuario como verificado y limpiar token
    await updateUser(user.id, {
      is_verified: true,
      verification_token: null,
      verification_expires: null
    });

    console.log('✅ Email verificado para:', user.email);
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isVerified: true
    };
  }

  // 👇 NUEVO MÉTODO PARA RENVIAR EMAIL DE VERIFICACIÓN
  static async resendVerificationEmail(email) {
    console.log('🔧 Reenviando email de verificación a:', email);
    
    const user = await findUserByEmail(email);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (user.is_verified) {
      throw new Error('El usuario ya está verificado');
    }

    // Generar nuevo token
    const newVerificationToken = crypto.randomBytes(32).toString('hex');
    const newVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Actualizar token en la base de datos
    await updateUser(user.id, {
      verification_token: newVerificationToken,
      verification_expires: newVerificationExpires
    });

    return {
      verificationToken: newVerificationToken,
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
        throw new Error('Usuario no encontrado');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        rol: user.rol,
        isVerified: user.is_verified, // 👈 Nuevo campo
        createdAt: user.created_at,
        iat: decoded.iat,
        exp: decoded.exp
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

    // 👇 VERIFICAR SI EL EMAIL ESTÁ CONFIRMADO (opcional)
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
        isVerified: user.is_verified, // 👈 Nuevo campo
        createdAt: user.created_at
      }, 
      token 
    };
  }
}