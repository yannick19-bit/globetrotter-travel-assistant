require('dotenv').config();
const mysql = require('mysql2/promise');

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await connection.query(`
    INSERT INTO destinations (name, country, category, budget_level, description, popularity_score) VALUES
    ('Bali', 'Indonesia', 'beach', 'moderate', 'Plages, temples et rizières en terrasses.', 95),
    ('Paris', 'France', 'city', 'luxury', 'La ville lumière, art et gastronomie.', 98),
    ('Swiss Alps', 'Switzerland', 'mountain', 'luxury', 'Randonnée et ski dans les Alpes.', 88),
    ('Bangkok', 'Thailand', 'city', 'budget', 'Marchés de rue et temples bouddhistes.', 90),
    ('Machu Picchu', 'Peru', 'culture', 'moderate', 'Cité inca perchée dans les Andes.', 92),
    ('Santorini', 'Greece', 'beach', 'luxury', 'Falaises blanches et couchers de soleil.', 94),
    ('Kyoto', 'Japan', 'culture', 'moderate', 'Temples anciens et jardins zen.', 91),
    ('Costa Rica', 'Costa Rica', 'adventure', 'moderate', 'Jungle, volcans et biodiversité.', 85),
    ('Marrakech', 'Morocco', 'culture', 'budget', 'Souks colorés et médina historique.', 83),
    ('Maldives', 'Maldives', 'relaxation', 'luxury', 'Bungalows sur pilotis et récifs coralliens.', 96)
  `);

  console.log('Destinations insérées avec succès.');
  await connection.end();
}

seed().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});