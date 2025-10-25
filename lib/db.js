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
        is_verified BOOLEAN DEFAULT FALSE, -- 👈 CAMBIADO: snake_case y valor por defecto
        verification_token TEXT, -- 👈 NUEVO: Token para verificación
        verification_expires TIMESTAMP WITH TIME ZONE, -- 👈 NUEVO: Expiración del token
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    await initDocumentsTable();
    
    dbInitialized = true;
    console.log('✅ Tabla users verificada/creada');
    
  } catch (error) {
    console.error('❌ Error inicializando DB:', error.message);
  }
}

// 👇 NUEVA FUNCIÓN: Buscar usuario por token de verificación
export async function findUserByVerificationToken(verificationToken) {
  const db = getSQL();
  try {
    const [user] = await db`
      SELECT id, email, name, rol, is_verified, verification_token, verification_expires, created_at 
      FROM users 
      WHERE verification_token = ${verificationToken}
    `;
    return user;
  } catch (error) {
    console.error('Error buscando usuario por token:', error);
    return null;
  }
}

// 👇 FUNCIÓN ACTUALIZADA Y CORREGIDA: Actualizar usuario
export async function updateUser(userId, updates) {
  const db = getSQL();
  try {
    // Filtrar campos undefined y construir el objeto de actualización
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && updates[key] !== null) {
        filteredUpdates[key] = updates[key];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    // Usar la sintaxis correcta de postgres.js para updates dinámicos
    const [updatedUser] = await db`
      UPDATE users 
      SET ${db(filteredUpdates)},
          updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, email, name, rol, is_verified, created_at, updated_at
    `;
    
    if (!updatedUser) {
      throw new Error('Usuario no encontrado');
    }
    
    return updatedUser;
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    throw new Error('Error actualizando usuario: ' + error.message);
  }
}

// 👇 MODIFICAR: Función createUser para aceptar verificación
export async function createUser(email, passwordHash, name = null, rol, verificationToken = null, verificationExpires = null) {
  const db = getSQL();
  try {
    const [user] = await db`
      INSERT INTO users (email, password_hash, name, rol, verification_token, verification_expires) 
      VALUES (${email}, ${passwordHash}, ${name}, ${rol}, ${verificationToken}, ${verificationExpires})
      RETURNING id, email, name, rol, is_verified, verification_token, verification_expires, created_at
    `;
    return user;
  } catch (error) {
    if (error.code === '23505') {
      throw new Error('Ya existe un usuario con este email');
    }
    throw new Error('Error creando usuario: ' + error.message);
  }
}

// 👇 MODIFICAR: Función findUserByEmail para incluir campos de verificación
export async function findUserByEmail(email) {
  const db = getSQL();
  try {
    const [user] = await db`
      SELECT id, email, password_hash, name, rol, is_verified, verification_token, verification_expires, created_at 
      FROM users 
      WHERE email = ${email}
    `;
    return user;
  } catch (error) {
    console.error('Error buscando usuario por email:', error);
    return null;
  }
}

// 👇 MODIFICAR: Función findUserById para incluir campos de verificación
export async function findUserById(id) {
  const db = getSQL();
  try {
    const [user] = await db`
      SELECT id, email, name, rol, is_verified, verification_token, verification_expires, created_at 
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

// 👇 FUNCIÓN PARA LEER TODAS LAS COMUNIDADES
export async function getAllComunidades() {
  const db = getSQL();
  try {
    const comunidades = await db`
      SELECT comunidad_numero, comunidad_direccion 
      FROM comunidades 
      ORDER BY comunidad_numero
    `;
    return comunidades;
  } catch (error) {
    console.error('Error obteniendo comunidades:', error);
    throw new Error('Error obteniendo comunidades: ' + error.message);
  }
}

// 👇 FUNCIÓN PARA OBTENER UNA COMUNIDAD POR NÚMERO
export async function getComunidadByNumero(numero) {
  const db = getSQL();
  let comunidad;
  try {
  if(numero === 1){
    comunidad = await db`SELECT * FROM comunidad1`;
  }
  if(numero === 2){
    comunidad = await db`SELECT * FROM comunidad2`;
  }
    return comunidad;
  } catch (error) {
    console.error('Error obteniendo comunidad por número:', error);
    throw new Error('Error obteniendo comunidad: ' + error.message);
  }
}

// 👇 FUNCIÓN PARA BUSCAR COMUNIDADES POR DIRECCIÓN (BÚSQUEDA PARCIAL)
export async function searchComunidadesByDireccion(direccion) {
  const db = getSQL();
  try {
    const comunidades = await db`
      SELECT comunidad_numero, comunidad_direccion 
      FROM comunidades 
      WHERE comunidad_direccion ILIKE ${'%' + direccion + '%'}
      ORDER BY comunidad_numero
    `;
    return comunidades;
  } catch (error) {
    console.error('Error buscando comunidades por dirección:', error);
    throw new Error('Error buscando comunidades: ' + error.message);
  }
}

// Exportar la conexión por si se necesita directamente
export { getSQL };
export default getSQL();