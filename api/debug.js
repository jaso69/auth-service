export default async function handler(req, res) {
  console.log('🔍 Debug endpoint llamado');
  
  try {
    // Respuesta mínima para verificar que funciona
    return res.status(200).json({
      success: true,
      message: '✅ Debug endpoint funcionando',
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('❌ Error en debug:', error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}