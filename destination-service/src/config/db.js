const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'globetrotter_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Vérifie la connexion au démarrage
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Connexion MySQL établie avec succès');
    conn.release();
  } catch (err) {
    console.error('❌ Impossible de se connecter à MySQL:', err.message);
    throw err;
  }
}

module.exports = { pool, testConnection };
