USE destination_db;

CREATE TABLE IF NOT EXISTS destinations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(100) NOT NULL,
  category ENUM('beach','mountain','city','culture','adventure','relaxation') NOT NULL,
  budget_level ENUM('budget','moderate','luxury') NOT NULL DEFAULT 'moderate',
  description TEXT,
  popularity_score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO destinations (name, country, category, budget_level, description, popularity_score) VALUES
('Bali', 'Indonesia', 'beach', 'moderate', 'Plages, temples et rizieres en terrasses.', 95),
('Paris', 'France', 'city', 'luxury', 'La ville lumiere, art et gastronomie.', 98),
('Swiss Alps', 'Switzerland', 'mountain', 'luxury', 'Randonnee et ski dans les Alpes.', 88),
('Bangkok', 'Thailand', 'city', 'budget', 'Marches de rue et temples bouddhistes.', 90),
('Machu Picchu', 'Peru', 'culture', 'moderate', 'Cite inca perchee dans les Andes.', 92),
('Santorini', 'Greece', 'beach', 'luxury', 'Falaises blanches et couchers de soleil.', 94),
('Kyoto', 'Japan', 'culture', 'moderate', 'Temples anciens et jardins zen.', 91),
('Costa Rica', 'Costa Rica', 'adventure', 'moderate', 'Jungle, volcans et biodiversite.', 85),
('Marrakech', 'Morocco', 'culture', 'budget', 'Souks colores et medina historique.', 83),
('Maldives', 'Maldives', 'relaxation', 'luxury', 'Bungalows sur pilotis et recifs coralliens.', 96);
