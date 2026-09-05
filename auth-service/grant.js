require('dotenv').config();
const mysql = require('mysql2/promise');

(async function grant() {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 3306;
  const rootUser = process.env.DB_USER;
  const rootPwd = process.env.DB_PASSWORD;
  const db = process.env.DB_NAME;
  const targetUser = process.env.TARGET_DB_USER || 'globetrotter';
  const targetPwd = process.env.TARGET_DB_PASSWORD || 'globetrotter_pwd';

  if (!rootUser || !rootPwd) {
    console.error('Root credentials not set in env (DB_USER/DB_PASSWORD).');
    process.exit(1);
  }
  if (!db) {
    console.error('DB_NAME not set in env.');
    process.exit(1);
  }

  try {
    const connection = await mysql.createConnection({ host, port, user: rootUser, password: rootPwd });

    // Create target user if it doesn't exist
    await connection.query(`CREATE USER IF NOT EXISTS '${targetUser}'@'%' IDENTIFIED BY '${targetPwd}'`);

    // Grant privileges on the database
    await connection.query(`GRANT ALL PRIVILEGES ON \`${db}\`.* TO '${targetUser}'@'%'`);
    await connection.query('FLUSH PRIVILEGES');

    console.log(`Privileges granted to ${targetUser} on ${db}`);
    await connection.end();
  } catch (err) {
    console.error('Error granting privileges:', err.message);
    process.exit(1);
  }
})();

// Ajout demandé : accorder les privilèges sur `destination_db`
async function grantDestination() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'yannick123', // ou le vrai mot de passe root si différent
  });

  await connection.query('CREATE DATABASE IF NOT EXISTS destination_db');
  await connection.query("GRANT ALL PRIVILEGES ON destination_db.* TO 'globetrotter'@'%'");
  await connection.query('FLUSH PRIVILEGES');

  console.log('Privilèges accordés sur destination_db pour globetrotter.');
  await connection.end();
}

grantDestination().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});

const mysql2 = require('mysql2/promise');

async function grant() {
  const connection = await mysql2.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'touopi1976', // ou le vrai mot de passe root si différent
  });

  await connection.query('CREATE DATABASE IF NOT EXISTS destination_db');
  await connection.query("GRANT ALL PRIVILEGES ON destination_db.* TO 'globetrotter'@'%'");
  await connection.query('FLUSH PRIVILEGES');

  console.log('Privilèges accordés sur destination_db pour globetrotter.');
  await connection.end();
}

grant().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
