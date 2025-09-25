import { createUser, findUserByEmail, findUserById } from './db.js';
import bcrypt from 'bcryptjs';
import { generateToken, verifyToken } from '../utils/jwt.js';

export class AuthService {
    static async register(email, password, userData = {}) {
        // Validaciones básicas
        if (!email || !password) {
            throw new Error('Email y contraseña son requeridos');
        }

        if (password.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres');
        }

        // Hash seguro de contraseña
        const passwordHash = await bcrypt.hash(password, 12);

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

    static async login(email, password) {
        if (!email || !password) {
            throw new Error('Email y contraseña son requeridos');
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

    static async verifyAuth(token) {
        if (!token) return null;

        const decoded = verifyToken(token);
        if (!decoded) return null;

        const user = await findUserById(decoded.userId);
        if (!user) return null;

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.created_at
        };
    }
}