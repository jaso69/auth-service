// db.js
import postgres from 'postgres';

console.log('🔧 Configurando conexión a PostgreSQL...');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL no configurada');
  // En Vercel, asegúrate de tener la variable de entorno configurada
}

// Crear una única instancia de conexión
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

// Inicializar base de datos (solo una vez)
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

// Exportar la función para obtener la conexión
export { getSQL };
export default getSQL();