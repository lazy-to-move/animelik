import mysql from 'mysql2/promise';

const c = await mysql.createConnection('mysql://root:YGJQSvvndtUT@localhost:3307/anime_db');

await c.query(`INSERT INTO users (unionId, name, email, role) VALUES (?, ?, ?, ?)`, 
  ['dev-user', 'Dev Admin', 'dev@localhost', 'admin']);

console.log('Admin user created!');

const [users] = await c.query('SELECT * FROM users');
console.log('All users:', users);

await c.end();