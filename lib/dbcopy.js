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

// Función para editar un usuario
export async function updateUser(id, updates) {
  try {
    // Validar que hay campos para actualizar
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('No se proporcionaron campos para actualizar');
    }

    // Campos permitidos para actualizar
    const allowedFields = ['email', 'name', 'rol'];
    const updateFields = {};
    
    // Filtrar solo los campos permitidos
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields[key] = value;
      }
    }

    // Si no hay campos válidos después de filtrar
    if (Object.keys(updateFields).length === 0) {
      throw new Error('No hay campos válidos para actualizar');
    }

    // Construir la consulta dinámicamente
    const setClause = Object.keys(updateFields)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');

    const values = Object.values(updateFields);
    values.push(id); // Añadir el ID al final para el WHERE

    // Usar consulta parametrizada para seguridad
    const [updatedUser] = await sql`
      UPDATE users 
      SET 
        ${sql(updateFields)},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, email, name, rol, created_at, updated_at
    `;

    if (!updatedUser) {
      throw new Error('Usuario no encontrado');
    }

    return updatedUser;

  } catch (error) {
    if (error.code === '23505') { // Violación de unique constraint
      throw new Error('Ya existe un usuario con este email');
    }
    throw new Error('Error actualizando usuario: ' + error.message);
  }
}

// Función específica para cambiar solo el rol
export async function updateUserRole(id, newRole) {
  try {
    const [updatedUser] = await sql`
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

// Función para cambiar contraseña (separada por seguridad)
export async function updateUserPassword(id, newPasswordHash) {
  try {
    const [updatedUser] = await sql`
      UPDATE users 
      SET 
        password_hash = ${newPasswordHash},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, email, name, updated_at
    `;

    if (!updatedUser) {
      throw new Error('Usuario no encontrado');
    }

    return updatedUser;

  } catch (error) {
    throw new Error('Error actualizando contraseña: ' + error.message);
  }
}

export default sql;