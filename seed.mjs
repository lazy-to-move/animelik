import mysql from 'mysql2/promise';

const c = await mysql.createConnection('mysql://root:YGJQSvvndtUT@localhost:3307/anime_db');

// Seed categories
await c.query(`INSERT IGNORE INTO categories (name, slug, description) VALUES
('Action', 'action', 'High-energy battles and intense sequences'),
('Adventure', 'adventure', 'Epic journeys and exploration'),
('Fantasy', 'fantasy', 'Magical worlds and supernatural powers'),
('Sci-Fi', 'sci-fi', 'Futuristic technology and space exploration'),
('Romance', 'romance', 'Love stories and relationships'),
('Comedy', 'comedy', 'Humorous and light-hearted stories'),
('Drama', 'drama', 'Emotional storytelling'),
('Mystery', 'mystery', 'Puzzles and investigations'),
('Horror', 'horror', 'Dark themes and terror'),
('Sports', 'sports', 'Competitive athletics')
`);

// Seed anime
await c.query(`INSERT IGNORE INTO anime (title, slug, synopsis, coverImage, status, type, rating, releaseYear, studio, score, episodesCount, duration, featured, categoryId) VALUES
('Neon Genesis', 'neon-genesis', 'In a post-apocalyptic world, young pilots command biomechanical titans to hold back entities from beyond the dimensional veil.', '/anime-covers/neon-genesis.jpg', 'ongoing', 'tv', 'PG-16', 2024, 'Studio TRIGGER', 9.20, 24, 24, 1, 1),
('Dragon Ball Super', 'dragon-ball-super', 'The saga continues as Goku and friends face new powerful enemies across multiple universes.', '/anime-covers/dragon-ball.jpg', 'ongoing', 'tv', 'PG-13', 2024, 'Toei Animation', 8.50, 100, 24, 1, 1),
('One Piece', 'one-piece', 'Follow Monkey D. Luffy and his crew as they search for the ultimate treasure, the One Piece.', '/anime-covers/one-piece.jpg', 'ongoing', 'tv', 'PG-13', 1999, 'Toei Animation', 9.10, 1100, 24, 1, 2),
('Attack on Titan', 'attack-on-titan', 'Humanity lives inside cities surrounded by enormous walls due to the Titans, giant humanoid creatures.', '/anime-covers/aot.jpg', 'completed', 'tv', 'R-17', 2021, 'MAPPA', 9.30, 87, 24, 1, 1),
('Demon Slayer', 'demon-slayer', 'A boy whose family was slaughtered and his sister turned into a demon joins the Demon Slayer Corps.', '/anime-covers/demon-slayer.jpg', 'completed', 'tv', 'PG-13', 2020, 'Ufotable', 9.40, 26, 24, 1, 1),
('Jujutsu Kaisen', 'jujutsu-kaisen', 'A boy joins a secret organization of sorcerers to kill a powerful curse and save his friend.', '/anime-covers/jjk.jpg', 'ongoing', 'tv', 'R-17', 2024, 'MAPPA', 8.90, 50, 24, 1, 1),
('My Hero Academia', 'my-hero-academia', 'In a world where most humans have superpowers, a boy without them dreams of becoming a hero.', '/anime-covers/mha.jpg', 'ongoing', 'tv', 'PG-13', 2024, 'Bones', 8.70, 100, 24, 1, 1),
('Naruto', 'naruto', 'A young ninja seeks recognition and dreams of becoming the Hokage.', '/anime-covers/naruto.jpg', 'completed', 'tv', 'PG-13', 2007, 'Pierrot', 8.80, 500, 24, 1, 1)
`);

// Seed episodes for first anime
for (let i = 1; i <= 6; i++) {
  const titles = ['The Beginning', 'First Battle', 'New Ally', 'Secret Revealed', 'Darkness Approaches', 'Final Showdown'];
  await c.query(`INSERT IGNORE INTO episodes (animeId, number, title, synopsis, duration) VALUES (1, ?, ?, ?, 1440)`, [i, `Episode ${i}: ${titles[i-1]}`, `Episode ${i} synopsis goes here...`]);
}

console.log('Seed data added!');
await c.end();