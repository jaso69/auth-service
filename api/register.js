// api/register.js - VERSIÓN CORREGIDA
console.log('✅ Register.js cargado correctamente');

export default async function handler(req, res) {
  console.log('🔍 Register endpoint llamado, método:', req.method);
  
  try {
    // Habilitar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
      console.log('✅ Preflight OPTIONS manejado');
      return res.status(200).end();
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
      console.log('❌ Método no permitido:', req.method);
      return res.status(405).json({ error: 'Método no permitido. Use POST.' });
    }

    // Verificar content-type
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({ error: 'Content-Type debe ser application/json' });
    }

    // Parsear el body
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log('📦 Body parseado:', body);
    } catch (parseError) {
      console.log('❌ Error parseando JSON:', parseError);
      return res.status(400).json({ error: 'JSON inválido en el body' });
    }

    const { email, password, name } = body;

    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email y contraseña requeridos',
        received: { email: !!email, password: !!password }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // ✅ SIMULACIÓN EXITOSA - Sin base de datos por ahora
    const mockUser = {
      id: Date.now(),
      email: email,
      name: name || 'Usuario',
      createdAt: new Date().toISOString()
    };

    // Token simulado
    const mockToken = `mock-jwt-token-${Date.now()}`;

    console.log('✅ Registro simulado exitoso para:', email);

    // Respuesta exitosa
    return res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente (modo simulación)',
      user: mockUser,
      token: mockToken,
      note: 'La base de datos se conectará en el siguiente paso'
    });

  } catch (error) {
    console.error('❌ Error inesperado en register:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}