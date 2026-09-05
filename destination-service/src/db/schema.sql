-- Destination Service — Schema
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
