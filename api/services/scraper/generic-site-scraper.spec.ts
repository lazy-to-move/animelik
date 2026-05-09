import { afterEach, describe, expect, it, vi } from "vitest";
import { searchAnimeWithConfig, type GenericSiteConfig } from "./generic-site-scraper";

const ristoConfig: GenericSiteConfig = {
  id: "ristoanime",
  name: "RistoAnime",
  baseUrl: "https://ristoanime.co",
  animePathSegment: "/series/",
  episodePathSegment: "/episode/",
  searchUrls: [(query) => `https://ristoanime.co/?s=${encodeURIComponent(query)}`],
};

describe("generic-site-scraper lightweight HTML parsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("parses MovieItem search cards with background-image posters", async () => {
    const html = `
      <!DOCTYPE html>
      <html lang="ar">
        <body>
          <div class="BlocksHolder" id="MainFiltar">
            <div class="MovieItem">
              <a href="https://ristoanime.co/series/%D8%AC%D9%85%D9%8A%D8%B9-%D8%AD%D9%84%D9%82%D8%A7%D8%AA-%D8%A7%D9%86%D9%85%D9%8A-%D9%86%D8%A7%D8%B1%D9%88%D8%AA%D9%88-naruto-%D9%85%D8%AA%D8%B1%D8%AC%D9%85%D8%A9-%D8%A7%D9%88%D9%86-%D9%84%D8%A7%D9%8A/">
                <div class="poster" style="background-image: url(https://ristoanime.co/wp-content/uploads/2024/07/animehq-Naruto.webp);"></div>
                <div class="title">
                  <p>مشاهدة انمي ناروتو Naruto الحلقة 1 مترجمة اون لاين</p>
                  <h4>جميع حلقات انمي ناروتو Naruto مترجمة اون لاين</h4>
                </div>
              </a>
            </div>
          </div>
        </body>
      </html>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const results = await searchAnimeWithConfig(ristoConfig, "naruto");

    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toContain("naruto");
    expect(results[0]?.slug).toContain("ناروتو");
    expect(results[0]?.title.toLowerCase()).toContain("naruto");
    expect(results[0]?.coverImage).toBe("https://ristoanime.co/wp-content/uploads/2024/07/animehq-Naruto.webp");
  });
});
