import { getDb } from "../api/queries/connection";
import { categories, anime, episodes } from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Seed categories
  const cats = await db.insert(categories).values([
    { name: "Action", slug: "action", description: "High-energy battles and intense sequences" },
    { name: "Adventure", slug: "adventure", description: "Epic journeys and exploration" },
    { name: "Fantasy", slug: "fantasy", description: "Magical worlds and supernatural powers" },
    { name: "Sci-Fi", slug: "sci-fi", description: "Futuristic technology and space exploration" },
    { name: "Romance", slug: "romance", description: "Love stories and relationships" },
    { name: "Horror", slug: "horror", description: "Dark themes and supernatural terror" },
    { name: "Comedy", slug: "comedy", description: "Humorous and light-hearted stories" },
    { name: "Drama", slug: "drama", description: "Emotional storytelling and character depth" },
    { name: "Mystery", slug: "mystery", description: "Puzzles, secrets, and investigations" },
    { name: "Sports", slug: "sports", description: "Competitive athletics and team spirit" },
  ]);
  console.log("Categories seeded:", cats);

  // Seed anime
  const animeData = [
    {
      title: "Neon Genesis: Eclipse",
      titleJp: "ネオンジェネシス エクリプス",
      slug: "neon-genesis-eclipse",
      synopsis: "In a post-apocalyptic Tokyo where reality itself is fracturing, young pilots command biomechanical titans to hold back entities from beyond the dimensional veil. As the boundary between human consciousness and the machine blurs, they must confront what it truly means to be human.",
      coverImage: "/anime-covers/neon-genesis.jpg",
      bannerImage: "/anime-banners/neon-genesis.jpg",
      status: "ongoing" as const,
      type: "tv" as const,
      rating: "PG-16",
      releaseYear: 2024,
      studio: "Studio TRIGGER",
      score: "9.20",
      episodesCount: 24,
      duration: 24,
      featured: true,
      categoryId: 1,
    },
    {
      title: "Crimson Blade Chronicles",
      titleJp: "紅い刃の編年史",
      slug: "crimson-blade-chronicles",
      synopsis: "In a feudal realm where honor is sharper than steel, an outcast samurai wielding a cursed crimson blade seeks redemption. Each cut of his weapon feeds an ancient hunger, and with every enemy felled, the line between hero and demon grows thinner.",
      coverImage: "/anime-covers/crimson-blade.jpg",
      bannerImage: "/anime-banners/crimson-blade.jpg",
      status: "completed" as const,
      type: "tv" as const,
      rating: "R-17+",
      releaseYear: 2023,
      studio: "MAPPA",
      score: "8.90",
      episodesCount: 12,
      duration: 23,
      featured: true,
      categoryId: 1,
    },
    {
      title: "Starlight Academy",
      titleJp: "スターライトアカデミー",
      slug: "starlight-academy",
      synopsis: "At an elite school hidden among the stars, students train to become cosmic navigators. When a mysterious signal from the edge of the galaxy threatens the academy, a group of unlikely friends must pilot an experimental starship into the unknown.",
      coverImage: "/anime-covers/starlight-academy.jpg",
      bannerImage: "/anime-banners/starlight-academy.jpg",
      status: "ongoing" as const,
      type: "tv" as const,
      rating: "PG-13",
      releaseYear: 2024,
      studio: "Kyoto Animation",
      score: "8.50",
      episodesCount: 13,
      duration: 24,
      featured: true,
      categoryId: 2,
    },
    {
      title: "Phantom Hearts",
      titleJp: "幽霊の心臓",
      slug: "phantom-hearts",
      synopsis: "In a world where emotions manifest as spectral entities, a young medium must help trapped spirits find peace. But when a vengeful phantom threatens to consume the city in eternal sorrow, she must face her own buried grief to save everyone she loves.",
      coverImage: "/anime-covers/phantom-hearts.jpg",
      bannerImage: "/anime-banners/phantom-hearts.jpg",
      status: "completed" as const,
      type: "tv" as const,
      rating: "PG-16",
      releaseYear: 2023,
      studio: "A-1 Pictures",
      score: "8.70",
      episodesCount: 22,
      duration: 24,
      featured: false,
      categoryId: 3,
    },
    {
      title: "Cyberpulse: Reboot",
      titleJp: "サイバーパルス リブート",
      slug: "cyberpulse-reboot",
      synopsis: "Decades after the Great Network Collapse, a rogue hacker discovers the key to restoring the digital world lies within the mind of an android child. Racing against megacorps who want the technology for themselves, they journey through the ruins of cyberspace.",
      coverImage: "/anime-covers/cyberpulse.jpg",
      bannerImage: "/anime-banners/cyberpulse.jpg",
      status: "ongoing" as const,
      type: "tv" as const,
      rating: "R-17+",
      releaseYear: 2024,
      studio: "Production I.G",
      score: "8.80",
      episodesCount: 18,
      duration: 25,
      featured: true,
      categoryId: 4,
    },
    {
      title: "Moonlit Garden",
      titleJp: "月光の庭園",
      slug: "moonlit-garden",
      synopsis: "Every full moon, a secret garden appears in the forest where spirits gather to share stories of love lost and found. A lonely florist discovers the entrance and finds herself entangled in a century-old romance that transcends life and death.",
      coverImage: "/anime-covers/moonlit-garden.jpg",
      bannerImage: "/anime-banners/moonlit-garden.jpg",
      status: "completed" as const,
      type: "tv" as const,
      rating: "PG-13",
      releaseYear: 2023,
      studio: "Studio Ghibli",
      score: "9.10",
      episodesCount: 11,
      duration: 22,
      featured: false,
      categoryId: 5,
    },
    {
      title: "Shadow Protocol",
      titleJp: "シャドウ プロトコル",
      slug: "shadow-protocol",
      synopsis: "When government black sites begin disappearing along with everyone inside them, an elite covert operative is activated. Her mission: infiltrate the conspiracy before a shadow organization can execute a plan that will rewrite the world's political landscape forever.",
      coverImage: "/anime-covers/shadow-protocol.jpg",
      bannerImage: "/anime-banners/shadow-protocol.jpg",
      status: "upcoming" as const,
      type: "tv" as const,
      rating: "R-17+",
      releaseYear: 2025,
      studio: "WIT Studio",
      score: "0.00",
      episodesCount: 0,
      duration: 24,
      featured: true,
      categoryId: 6,
    },
    {
      title: "Laugh Track High",
      titleJp: "笑ってハイスクール",
      slug: "laugh-track-high",
      synopsis: "At the most chaotic high school in Japan, the Comedy Club is on the verge of being shut down. A transfer student with stage fright must somehow lead a misfit crew of aspiring comedians to victory at the national tournament or watch their dreams dissolve.",
      coverImage: "/anime-covers/laugh-track-high.jpg",
      bannerImage: "/anime-banners/laugh-track-high.jpg",
      status: "ongoing" as const,
      type: "tv" as const,
      rating: "PG-13",
      releaseYear: 2024,
      studio: "Science SARU",
      score: "7.90",
      episodesCount: 26,
      duration: 23,
      featured: false,
      categoryId: 7,
    },
  ];

  const animeResults = await db.insert(anime).values(animeData);
  console.log("Anime seeded:", animeResults);

  // Seed episodes for first anime
  const epData = [];
  for (let i = 1; i <= 12; i++) {
    epData.push({
      animeId: 1,
      number: i,
      title: `Episode ${i}: ${["The Fracture", "Biomech Awakening", "Dimensional Rift", "Pilot's Burden", "Beyond the Veil", "Neural Sync", "Ghost Protocol", "Reality Anchor", "Void Walker", "Eclipse Rising", "Last Stand", "Genesis Reborn"][i - 1]}`,
      synopsis: `In episode ${i}, the pilots face escalating challenges as the dimensional barriers weaken and new truths about the biomechs come to light.`,
      thumbnail: `/anime-covers/neon-genesis.jpg`,
      videoUrl: "",
      duration: 1440,
      airDate: new Date(2024, 0, i * 7),
    });
  }

  const epResults = await db.insert(episodes).values(epData);
  console.log("Episodes seeded:", epResults);

  console.log("Done.");
  process.exit(0);
}

seed();
