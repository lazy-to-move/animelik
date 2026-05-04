import { describe, expect, it } from "vitest";
import { buildSearchAliases, normalizeSearchText, scoreAnimeSearch, type SearchableAnime } from "./lib/anime-search";

function makeAnime(overrides: Partial<SearchableAnime>): SearchableAnime {
  return {
    title: "Kiseijuu: Sei no Kakuritsu",
    titleEnglish: "Parasyte: The Maxim",
    titleJp: "寄生獣 セイの格率",
    titleSynonyms: ["Parasyte", "Kiseiju"],
    slug: "kiseijuu-sei-no-kakuritsu",
    ...overrides,
  };
}

describe("anime search helpers", () => {
  it("normalizes punctuation and spacing", () => {
    expect(normalizeSearchText("  Attack-on   Titan!! ")).toBe("attack on titan");
  });

  it("builds aliases from titles, synonyms, and slug", () => {
    const aliases = buildSearchAliases(makeAnime({}));
    expect(aliases).toContain("parasyte the maxim");
    expect(aliases).toContain("parasyte");
    expect(aliases).toContain("kiseijuu sei no kakuritsu");
  });

  it("prioritizes exact english alias matches", () => {
    const anime = makeAnime({});
    expect(scoreAnimeSearch(anime, "parasyte")).toBeGreaterThan(80);
  });

  it("tolerates small typos on romaji names", () => {
    const anime = makeAnime({});
    expect(scoreAnimeSearch(anime, "kiseijuu sei no kakuritu")).toBeGreaterThan(60);
  });

  it("does not strongly match unrelated anime on tiny token overlap", () => {
    const relevant = makeAnime({});
    const unrelated = makeAnime({
      title: "Seihantai na Kimi to Boku",
      titleEnglish: "You and I Are Polar Opposites",
      titleSynonyms: [],
      slug: "seihantai-na-kimi-to-boku",
    });

    expect(scoreAnimeSearch(relevant, "parasite")).toBeGreaterThan(0);
    expect(scoreAnimeSearch(unrelated, "parasite")).toBe(0);
  });
});
