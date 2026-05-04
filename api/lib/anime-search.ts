export type SearchableAnime = {
  title: string;
  titleEnglish: string | null;
  titleJp: string | null;
  titleSynonyms: string[] | null;
  slug: string;
};

export function normalizeSearchText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

export function buildSearchAliases(item: SearchableAnime) {
  const aliases = new Set<string>();
  const rawValues = [
    item.title,
    item.titleEnglish,
    item.titleJp,
    ...(item.titleSynonyms ?? []),
    item.slug.replace(/-/g, " "),
  ];

  for (const rawValue of rawValues) {
    const normalized = normalizeSearchText(rawValue);
    if (!normalized) continue;

    aliases.add(normalized);

    const compact = normalized.replace(/\s+/g, " ");
    if (compact !== normalized) {
      aliases.add(compact);
    }

    for (const part of normalized.split(/\s{2,}|[/:|]/)) {
      const trimmed = normalizeSearchText(part);
      if (trimmed) aliases.add(trimmed);
    }
  }

  return Array.from(aliases);
}

export function scoreAnimeSearch(item: SearchableAnime, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const aliases = buildSearchAliases(item);
  let bestScore = 0;

  for (const alias of aliases) {
    if (alias === normalizedQuery) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    if (alias.startsWith(normalizedQuery)) {
      bestScore = Math.max(bestScore, 92);
    }

    if (alias.includes(normalizedQuery)) {
      bestScore = Math.max(bestScore, 88);
    }

    const aliasTokens = alias.split(" ").filter((token) => token.length >= 3);
    const matchedTokens = queryTokens.filter((token) =>
      token.length >= 3 &&
      aliasTokens.some((aliasToken) => {
        if (aliasToken === token) return true;
        if (token.length >= 5 && aliasToken.startsWith(token)) return true;
        if (aliasToken.length >= 5 && token.startsWith(aliasToken)) return true;
        return false;
      }),
    ).length;

    if (matchedTokens > 0) {
      bestScore = Math.max(bestScore, 60 + matchedTokens * 8);
    }

    if (queryTokens.length === 1) {
      for (const aliasToken of aliasTokens) {
        const distance = levenshteinDistance(queryTokens[0], aliasToken);
        if (distance <= 2) {
          bestScore = Math.max(bestScore, 72 - distance * 8);
        }
      }
    } else {
      const compactAlias = alias.replace(/\s+/g, "");
      const compactQuery = normalizedQuery.replace(/\s+/g, "");
      const distance = levenshteinDistance(compactQuery, compactAlias);
      const allowedDistance = compactQuery.length >= 10 ? 3 : 2;
      if (distance <= allowedDistance) {
        bestScore = Math.max(bestScore, 70 - distance * 6);
      }
    }
  }

  return bestScore;
}
