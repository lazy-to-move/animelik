Set-Location "C:\Users\Expert Gaming\Downloads\projects\Kimi_Agent_Full-Stack Anime Streaming Site\app"
$config = node -e "import 'dotenv/config'; console.log(JSON.stringify({ APP_ID: process.env.APP_ID, APP_SECRET: process.env.APP_SECRET, DATABASE_URL: process.env.DATABASE_URL }))" | ConvertFrom-Json
$env:NODE_ENV = "production"
$env:PORT = "3311"
$env:APP_ID = $config.APP_ID
$env:APP_SECRET = $config.APP_SECRET
$env:DATABASE_URL = $config.DATABASE_URL
$env:LEGACY_API_INTERNAL_ORIGIN = "http://127.0.0.1:3310"
$env:LEGACY_API_BASE_URL = "http://127.0.0.1:3310"
$env:NEXT_PUBLIC_LEGACY_API_BASE_URL = "http://127.0.0.1:3310"
$env:NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3311"
npm run next:start
