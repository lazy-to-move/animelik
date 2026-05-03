import mysql from 'mysql2/promise';
import * as jose from 'jose';

const c = await mysql.createConnection('mysql://root:@localhost:3306/anime_db');

const [users] = await c.query('SELECT * FROM users WHERE unionId = ?', ['dev-user']);
console.log('Users found:', users.length);

if (!users.length) {
  await c.query(`INSERT INTO users (unionId, name, email, role) VALUES (?, ?, ?, ?)`, 
    ['dev-user', 'Dev Admin', 'dev@localhost', 'admin']);
  console.log('Created dev user');
}

// Create JWT token using jose
const secret = new TextEncoder().encode('dev-secret-key-min-32-chars-long-here');
const token = await new jose.SignJWT({ sub: '1', role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(secret);

console.log('Token generated!');
console.log('Use this cookie: session=' + token);

await c.end();