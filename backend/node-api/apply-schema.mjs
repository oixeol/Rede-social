import { createDatabase } from './lib/db/index.js';
import fs from 'fs';

const db = createDatabase({ sqlitePath: './data/vibra.db' });
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const content = fs.readFileSync('server.js', 'utf8');
const match = content.match(/const SQLITE_SCHEMA = `([\s\S]*?)`;/);
if (match) {
  console.log('Found schema, length:', match[1].length);
  try {
    db.exec(match[1]);
    console.log('Schema executed successfully');
  } catch (e) {
    console.log('Error:', e.message);
  }
} else {
  console.log('Schema not found');
}
console.log('Tables after exec:', db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name));