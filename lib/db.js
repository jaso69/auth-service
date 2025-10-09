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

// Añade esto al final de tu db.js, antes de los exports

// 👇 NUEVA TABLA: Documents
export async function initDocumentsTable() {
  try {
    const db = getSQL();
    
    await db`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        file_size INTEGER,
        file_type VARCHAR(50),
        uploaded_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    console.log('✅ Tabla documents verificada/creada');
  } catch (error) {
    console.error('❌ Error creando tabla documents:', error);
    throw error;
  }
}

// 👇 FUNCIÓN: Obtener todos los documentos activos
export async function getAllDocuments() {
  const db = getSQL();
  try {
    const documents = await db`
      SELECT 
        d.id,
        d.name,
        d.brand,
        d.model,
        d.file_name,
        d.file_url,
        d.file_size,
        d.file_type,
        d.created_at,
        d.updated_at,
        u.name as uploaded_by_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.is_active = TRUE
      ORDER BY d.brand, d.model, d.created_at DESC
    `;
    return documents;
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    throw new Error('Error obteniendo documentos: ' + error.message);
  }
}

// 👇 FUNCIÓN: Crear nuevo documento
export async function createDocument(documentData) {
  console.log('📄 Creando documento con datos:', documentData);
  const db = getSQL();
  try {
    const [document] = await db`
      INSERT INTO documents (
        name, brand, model, 
        file_name, file_url, file_size, file_type,
        uploaded_by
      ) 
      VALUES (
        ${documentData.name},
        ${documentData.brand},
        ${documentData.model},
        ${documentData.file_name},
        ${documentData.file_url},
        ${documentData.file_size},
        ${documentData.file_type},
        ${documentData.uploaded_by}
      )
      RETURNING *
    `;
    return document;
  } catch (error) {
    console.error('Error creando documento:', error);
    throw new Error('Error creando documento: ' + error.message);
  }
}

// 👇 FUNCIÓN: Actualizar documento
export async function updateDocument(documentId, updates) {
  const db = getSQL();
  try {
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && updates[key] !== null) {
        filteredUpdates[key] = updates[key];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    const [updatedDocument] = await db`
      UPDATE documents 
      SET ${db(filteredUpdates)},
          updated_at = NOW()
      WHERE id = ${documentId}
      RETURNING *
    `;
    
    if (!updatedDocument) {
      throw new Error('Documento no encontrado');
    }
    
    return updatedDocument;
  } catch (error) {
    console.error('Error actualizando documento:', error);
    throw new Error('Error actualizando documento: ' + error.message);
  }
}

// 👇 FUNCIÓN: Eliminar documento (soft delete)
export async function deleteDocument(documentId) {
  const db = getSQL();
  try {
    const [document] = await db`
      UPDATE documents 
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = ${documentId}
      RETURNING id, name
    `;
    
    if (!document) {
      throw new Error('Documento no encontrado');
    }
    
    return document;
  } catch (error) {
    console.error('Error eliminando documento:', error);
    throw new Error('Error eliminando documento: ' + error.message);
  }
}

// 👇 FUNCIÓN: Buscar documentos por término
export async function searchDocuments(searchTerm) {
  const db = getSQL();
  try {
    const documents = await db`
      SELECT 
        id, name, type, category, brand, model,
        file_name, file_url, file_size, keywords, description
      FROM documents 
      WHERE is_active = TRUE AND (
        name ILIKE ${'%' + searchTerm + '%'} OR
        brand ILIKE ${'%' + searchTerm + '%'} OR
        model ILIKE ${'%' + searchTerm + '%'} OR
        description ILIKE ${'%' + searchTerm + '%'} OR
        keywords @> ${[searchTerm]}::TEXT[] OR
        array_to_string(keywords, ' ') ILIKE ${'%' + searchTerm + '%'}
      )
      ORDER BY 
        CASE 
          WHEN name ILIKE ${'%' + searchTerm + '%'} THEN 1
          WHEN brand ILIKE ${'%' + searchTerm + '%'} THEN 2
          WHEN model ILIKE ${'%' + searchTerm + '%'} THEN 3
          ELSE 4
        END
    `;
    return documents;
  } catch (error) {
    console.error('Error buscando documentos:', error);
    throw new Error('Error buscando documentos: ' + error.message);
  }
}

// Exportar la conexión por si se necesita directamente
export { getSQL };
export default getSQL();