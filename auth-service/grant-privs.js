require('dotenv').config();
const mysql = require('mysql2/promise');

(async function grant() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const db = process.env.DB_NAME;
  const user = 'globetrotter';
  const pwd = 'globetrotter_pwd';

  // Grant privileges and ensure user has the specified password
  await connection.query(`CREATE USER IF NOT EXISTS '${user}'@'%' IDENTIFIED BY '${pwd}'`);
  await connection.query(`GRANT ALL PRIVILEGES ON ${db}.* TO '${user}'@'%'`);
  await connection.query('FLUSH PRIVILEGES');

  console.log(`Privileges granted to ${user} on ${db}`);
  await connection.end();
})().catch(err => {
  console.error('Erreur grant:', err.message);
  process.exit(1);
});
