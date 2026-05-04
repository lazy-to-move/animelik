import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const categories = [
  ["Action", "action", "High-energy battles and intense sequences"],
  ["Adventure", "adventure", "Epic journeys and exploration"],
  ["Fantasy", "fantasy", "Magical worlds and supernatural powers"],
  ["Sci-Fi", "sci-fi", "Futuristic technology and space exploration"],
  ["Romance", "romance", "Love stories and relationships"],
  ["Comedy", "comedy", "Humorous and light-hearted stories"],
  ["Drama", "drama", "Emotional storytelling"],
  ["Mystery", "mystery", "Puzzles and investigations"],
  ["Horror", "horror", "Dark themes and terror"],
  ["Sports", "sports", "Competitive athletics"],
];

for (const [name, slug, description] of categories) {
  await pool.query(
    `
      INSERT INTO "categories" ("name", "slug", "description")
      VALUES ($1, $2, $3)
      ON CONFLICT ("slug") DO UPDATE SET
        "name" = EXCLUDED."name",
        "description" = EXCLUDED."description"
    `,
    [name, slug, description],
  );
}

const categoryMap = new Map(
  (
    await pool.query(`SELECT "id", "slug" FROM "categories"`)
  ).rows.map((row) => [row.slug, row.id]),
);

const animeRows = [
  ["Neon Genesis", "neon-genesis", "In a post-apocalyptic world, young pilots command biomechanical titans to hold back entities from beyond the dimensional veil.", "/anime-covers/neon-genesis.jpg", "ongoing", "tv", "PG-16", 2024, "Studio TRIGGER", "9.20", 24, 24, true, "action"],
  ["Dragon Ball Super", "dragon-ball-super", "The saga continues as Goku and friends face new powerful enemies across multiple universes.", "/anime-covers/dragon-ball.jpg", "ongoing", "tv", "PG-13", 2024, "Toei Animation", "8.50", 100, 24, true, "action"],
  ["One Piece", "one-piece", "Follow Monkey D. Luffy and his crew as they search for the ultimate treasure, the One Piece.", "/anime-covers/one-piece.jpg", "ongoing", "tv", "PG-13", 1999, "Toei Animation", "9.10", 1100, 24, true, "adventure"],
  ["Attack on Titan", "attack-on-titan", "Humanity lives inside cities surrounded by enormous walls due to the Titans, giant humanoid creatures.", "/anime-covers/aot.jpg", "completed", "tv", "R-17", 2021, "MAPPA", "9.30", 87, 24, true, "action"],
  ["Demon Slayer", "demon-slayer", "A boy whose family was slaughtered and his sister turned into a demon joins the Demon Slayer Corps.", "/anime-covers/demon-slayer.jpg", "completed", "tv", "PG-13", 2020, "Ufotable", "9.40", 26, 24, true, "action"],
  ["Jujutsu Kaisen", "jujutsu-kaisen", "A boy joins a secret organization of sorcerers to kill a powerful curse and save his friend.", "/anime-covers/jjk.jpg", "ongoing", "tv", "R-17", 2024, "MAPPA", "8.90", 50, 24, true, "action"],
  ["My Hero Academia", "my-hero-academia", "In a world where most humans have superpowers, a boy without them dreams of becoming a hero.", "/anime-covers/mha.jpg", "ongoing", "tv", "PG-13", 2024, "Bones", "8.70", 100, 24, true, "action"],
  ["Naruto", "naruto", "A young ninja seeks recognition and dreams of becoming the Hokage.", "/anime-covers/naruto.jpg", "completed", "tv", "PG-13", 2007, "Pierrot", "8.80", 500, 24, true, "action"],
];

for (const row of animeRows) {
  const [
    title,
    slug,
    synopsis,
    coverImage,
    status,
    type,
    rating,
    releaseYear,
    studio,
    score,
    episodesCount,
    duration,
    featured,
    categorySlug,
  ] = row;

  await pool.query(
    `
      INSERT INTO "anime"
        ("title", "slug", "synopsis", "coverImage", "status", "type", "rating", "releaseYear", "studio", "score", "episodesCount", "duration", "featured", "categoryId")
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT ("slug") DO UPDATE SET
        "title" = EXCLUDED."title",
        "synopsis" = EXCLUDED."synopsis",
        "coverImage" = EXCLUDED."coverImage",
        "status" = EXCLUDED."status",
        "type" = EXCLUDED."type",
        "rating" = EXCLUDED."rating",
        "releaseYear" = EXCLUDED."releaseYear",
        "studio" = EXCLUDED."studio",
        "score" = EXCLUDED."score",
        "episodesCount" = EXCLUDED."episodesCount",
        "duration" = EXCLUDED."duration",
        "featured" = EXCLUDED."featured",
        "categoryId" = EXCLUDED."categoryId"
    `,
    [title, slug, synopsis, coverImage, status, type, rating, releaseYear, studio, score, episodesCount, duration, featured, categoryMap.get(categorySlug) ?? null],
  );
}

const animeIdResult = await pool.query(`SELECT "id" FROM "anime" WHERE "slug" = 'neon-genesis' LIMIT 1`);
const firstAnimeId = animeIdResult.rows[0]?.id;

if (firstAnimeId) {
  const titles = ["The Beginning", "First Battle", "New Ally", "Secret Revealed", "Darkness Approaches", "Final Showdown"];
  for (let index = 0; index < titles.length; index += 1) {
    const number = index + 1;
    await pool.query(
      `
        INSERT INTO "episodes" ("animeId", "number", "title", "synopsis", "duration")
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `,
      [firstAnimeId, number, `Episode ${number}: ${titles[index]}`, `Episode ${number} synopsis goes here...`, 24],
    );
  }
}

console.log("Seed data added!");
await pool.end();
