// db.js
import postgres from 'postgres';

console.log('🔧 Configurando conexión a PostgreSQL...');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL no configurada');
}

let sql;

function getSQL() {
  if (!sql) {
    sql = postgres(connectionString, {
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      connect_timeout: 10,
      onnotice: () => {},
    });
    
    console.log('✅ Conexión a PostgreSQL establecida');
  }
  return sql;
}

// Inicializar base de datos
let dbInitialized = false;
export async function initDB() {
  if (dbInitialized) return;
  
  try {
    console.log('🔄 Inicializando base de datos...');
    const db = getSQL();
    
    await db`
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
    
    dbInitialized = true;
    console.log('✅ Tabla users verificada/creada');
    
  } catch (error) {
    console.error('❌ Error inicializando DB:', error.message);
  }
}

// 🔥 CORREGIR: Exportar las funciones usando getSQL() internamente

// Operaciones de usuario
export async function createUser(email, passwordHash, name = null, rol) {
  const db = getSQL();
  try {
    const [user] = await db`
      INSERT INTO users (email, password_hash, name) 
      VALUES (${email}, ${passwordHash}, ${name}, ${rol})
      RETURNING id, email, name, rol, created_at
    `;
    return user;
  } catch (error) {
    if (error.code === '23505') {
      throw new Error('Ya existe un usuario con este email');
    }
    throw new Error('Error creando usuario: ' + error.message);
  }
}

export async function findUserByEmail(email) {
  const db = getSQL();
  const [user] = await db`
    SELECT id, email, password_hash, name, rol, created_at 
    FROM users 
    WHERE email = ${email}
  `;
  return user;
}

export async function findUserById(id) {
  const db = getSQL();
  try {
    const [user] = await db`
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

export async function updateUserRole(id, newRole) {
  const db = getSQL();
  try {
    const [updatedUser] = await db`
      UPDATE users 
      SET 
        rol = ${newRole},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, email, name, rol, updated_at
    `;

    if (!updatedUser) {
      throw new Error('Usuario no encontrado');
    }

    return updatedUser;
  } catch (error) {
    throw new Error('Error actualizando rol: ' + error.message);
  }
}

// Exportar la conexión por si se necesita directamente
export { getSQL };
export default getSQL();