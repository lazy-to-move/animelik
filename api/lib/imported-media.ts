import fs from "fs";
import path from "path";

function getBundledAnimeCoversDir() {
  return path.resolve(process.cwd(), "public", "anime-covers");
}

export function getImportedAnimeCoversDir() {
  return path.resolve(
    process.env.IMPORTED_MEDIA_DIR || getBundledAnimeCoversDir()
  );
}

export function ensureImportedAnimeCoversDir() {
  const dir = getImportedAnimeCoversDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function toSafeResolvedPath(root: string, relativePath: string) {
  const normalized = path
    .normalize(relativePath)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, normalized);

  if (
    candidate !== resolvedRoot &&
    !candidate.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    return null;
  }

  return candidate;
}

export function findAnimeCoverFile(requestPath: string) {
  const decodedPath = decodeURIComponent(requestPath).replace(/^\/+/, "");
  if (!decodedPath) return null;

  const importedDir = getImportedAnimeCoversDir();
  const bundledDir = getBundledAnimeCoversDir();
  const roots =
    importedDir === bundledDir ? [importedDir] : [importedDir, bundledDir];

  for (const root of roots) {
    const candidate = toSafeResolvedPath(root, decodedPath);
    if (!candidate) continue;
    if (!fs.existsSync(candidate)) continue;

    const stat = fs.statSync(candidate);
    if (stat.isFile()) {
      return candidate;
    }
  }

  return null;
}

export function getFileContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".avif":
      return "image/avif";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
