require('dotenv').config();
const mysql = require('mysql2/promise');

async function clean() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [result] = await connection.query(`
    DELETE d1 FROM destinations d1
    INNER JOIN destinations d2
    WHERE d1.id > d2.id AND d1.name = d2.name AND d1.country = d2.country
  `);

  console.log(`${result.affectedRows} doublons supprimés.`);
  await connection.end();
}

clean().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});