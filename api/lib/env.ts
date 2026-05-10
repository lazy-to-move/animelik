import "dotenv/config";

function read(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export const env = {
  appId: read("APP_ID"),
  appSecret: read("APP_SECRET"),
  googleClientId: read("GOOGLE_CLIENT_ID"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: read("DATABASE_URL"),
  siteUrl: read("SITE_URL"),
  kimiAuthUrl: read("KIMI_AUTH_URL"),
  kimiOpenUrl: read("KIMI_OPEN_URL"),
  ownerUnionId: read("OWNER_UNION_ID"),
};
