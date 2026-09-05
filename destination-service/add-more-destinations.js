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
    ('Maldives Sud', 'Maldives', 'beach', 'luxury', 'Lagons turquoise et bungalows sur pilotis.', 97),
    ('Phuket', 'Thailand', 'beach', 'moderate', 'Plages animées et vie nocturne tropicale.', 89),
    ('Cancun', 'Mexico', 'beach', 'moderate', 'Plages de sable blanc et ruines mayas a proximite.', 90),
    ('Ibiza', 'Spain', 'beach', 'luxury', 'Criques mediterraneennes et ambiance festive.', 88),
    ('Copacabana', 'Brazil', 'beach', 'moderate', 'Plage iconique de Rio avec vue sur le Pain de Sucre.', 91),
    ('Dubai', 'United Arab Emirates', 'city', 'luxury', 'Gratte-ciels futuristes et shopping de luxe.', 96),
    ('New York', 'United States', 'city', 'luxury', 'La ville qui ne dort jamais, culture et gratte-ciels.', 97),
    ('Barcelona', 'Spain', 'city', 'moderate', 'Architecture de Gaudi et vie mediterraneenne.', 93),
    ('Singapore', 'Singapore', 'city', 'luxury', 'Metropole futuriste et jardins spectaculaires.', 94),
    ('Prague', 'Czech Republic', 'culture', 'moderate', 'Chateaux medievaux et ruelles historiques.', 90),
    ('Rome', 'Italy', 'culture', 'moderate', 'Berceau de l Empire romain et art de la Renaissance.', 96),
    ('Kyoto Temples', 'Japan', 'culture', 'luxury', 'Temples ancestraux et jardins zen raffines.', 92),
    ('Ubud', 'Indonesia', 'relaxation', 'luxury', 'Rizieres en terrasses et retraites bien-etre.', 91),
    ('Bora Bora', 'French Polynesia', 'relaxation', 'luxury', 'Lagon paradisiaque et villas sur l eau.', 98),
    ('Chiang Mai', 'Thailand', 'relaxation', 'budget', 'Temples paisibles et nature montagneuse.', 85)
  `);

  console.log('15 nouvelles destinations ajoutees avec succes.');
  await connection.end();
}

seed().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});