import postgres from 'postgres';

console.log('🔧 Configurando conexión a PostgreSQL...');

// Conexión con valores por defecto para desarrollo
const connectionString = process.env.DATABASE_URL || 'postgresql://user:pass@localhost/db';

const sql = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connect_timeout: 10,
  onnotice: () => {}, // Silenciar notices
});

// Inicializar base de datos
export async function initDB() {
  try {
    console.log('🔄 Inicializando base de datos...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        rol VARCHAR(100) DEFAULT 'guest',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    console.log('✅ Tabla users verificada/creada');
    
  } catch (error) {
    console.error('❌ Error inicializando DB:', error.message);
    // No lanzar error para no bloquear la app
  }
}

// Operaciones de usuario
export async function createUser(email, passwordHash, name = null) {
  try {
    const [user] = await sql`
      INSERT INTO users (email, password_hash, name) 
      VALUES (${email}, ${passwordHash}, ${name})
      RETURNING id, email, name, rol, created_at
    `;
    return user;
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      throw new Error('Ya existe un usuario con este email');
    }
    throw new Error('Error creando usuario: ' + error.message);
  }
}

export async function findUserByEmail(email) {
  const [user] = await sql`
    SELECT id, email, password_hash, name, rol, created_at 
    FROM users 
    WHERE email = ${email}
  `;
  return user;
}

export async function findUserById(id) {
  try {
    const [user] = await sql`
      SELECT id, email, name, rol, created_at 
      FROM users 
      WHERE id = ${id}
    `;
    return user;
  } catch (error) {
    console.error('Error buscando usuario por ID:', error);
    return null;
  }
}

export default sql;