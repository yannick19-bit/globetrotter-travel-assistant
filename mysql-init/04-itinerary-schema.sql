USE itinerary_db;

CREATE TABLE IF NOT EXISTS itineraries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  start_date DATE,
  end_date DATE,
  status ENUM('draft','confirmed','completed','cancelled') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itinerary_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  itinerary_id INT NOT NULL,
  destination_id INT NOT NULL,
  visit_order INT DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS itinerary_shares (
  id INT AUTO_INCREMENT PRIMARY KEY,
  itinerary_id INT NOT NULL,
  shared_with_user_id INT NOT NULL,
  permission ENUM('view','edit') DEFAULT 'view',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE,
  UNIQUE KEY unique_share (itinerary_id, shared_with_user_id)
);
