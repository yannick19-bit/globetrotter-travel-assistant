require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function init() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
  console.log(`Base ${process.env.DB_NAME} créée ou déjà existante.`);

  await connection.query(`USE ${process.env.DB_NAME}`);

 const schema = fs.readFileSync(path.join(__dirname, 'src', 'db', 'schema.sql'), 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);

  for (const stmt of statements) {
    await connection.query(stmt);
  }
  console.log('Schéma appliqué avec succès.');

  await connection.end();
}

init().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});