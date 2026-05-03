const mysql = require('mysql2/promise');

async function setup() {
  const c = await mysql.createConnection('mysql://root:@localhost:3306');

  await c.query('CREATE DATABASE IF NOT EXISTS anime_db');
  await c.query('USE anime_db');

  await c.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      slug VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await c.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unionId VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255),
      email VARCHAR(320),
      avatar TEXT,
      role ENUM('user','admin') DEFAULT 'user',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      lastSignInAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await c.query(`
    CREATE TABLE IF NOT EXISTS anime (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      titleJp VARCHAR(255),
      slug VARCHAR(255) NOT NULL UNIQUE,
      synopsis TEXT NOT NULL,
      coverImage VARCHAR(500),
      bannerImage VARCHAR(500),
      status ENUM('ongoing','completed','upcoming') DEFAULT 'upcoming',
      type ENUM('tv','movie','ova','special') DEFAULT 'tv',
      rating VARCHAR(10),
      releaseYear INT,
      studio VARCHAR(100),
      score DECIMAL(3,2) DEFAULT 0.00,
      episodesCount INT DEFAULT 0,
      duration INT,
      featured BOOLEAN DEFAULT FALSE,
      categoryId INT UNSIGNED,
      externalId VARCHAR(255),
      externalSlug VARCHAR(255),
      lastScrapedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    )
  `);

  await c.query(`
    CREATE TABLE IF NOT EXISTS episodes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      animeId INT UNSIGNED NOT NULL,
      number INT NOT NULL,
      title VARCHAR(255),
      synopsis TEXT,
      thumbnail VARCHAR(500),
      videoUrl VARCHAR(500),
      videoSources JSON,
      duration INT,
      airDate DATE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (animeId) REFERENCES anime(id) ON DELETE CASCADE
    )
  `);

  await c.query(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT UNSIGNED NOT NULL,
      animeId INT UNSIGNED NOT NULL,
      status ENUM('watching','completed','plan_to_watch','dropped') DEFAULT 'watching',
      currentEpisode INT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (animeId) REFERENCES anime(id) ON DELETE CASCADE
    )
  `);

  await c.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT UNSIGNED NOT NULL,
      animeId INT UNSIGNED NOT NULL,
      rating INT NOT NULL,
      comment TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (animeId) REFERENCES anime(id) ON DELETE CASCADE
    )
  `);

  console.log('All tables created!');
  await c.end();
}

setup().catch(console.error);