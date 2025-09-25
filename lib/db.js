import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
    ssl: require
});

export async function initDB() {
    // Crear tabla si no existe
    await sql`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `;
    console.log('✅ Base de datos inicializada');
}

export async function createUser(email, passwordHash, name) {
    try {
        const [user] = await sql`
            INSERT INTO users (email, password_hash, name) 
            VALUES (${email}, ${passwordHash}, ${name})
            RETURNING id, email, name, created_at
        `;
        return user;
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            throw new Error('El usuario ya existe');
        }
        throw error;
    }
}

export async function findUserByEmail(email) {
    const [user] = await sql`
        SELECT * FROM users WHERE email = ${email}
    `;
    return user;
}

export default sql;