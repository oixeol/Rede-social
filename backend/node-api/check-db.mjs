import { createDatabase } from './lib/db/index.js';
const db = createDatabase({ sqlitePath: './data/vibra.db' });
console.log('tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all());
console.log('chat_spaces:', db.prepare("PRAGMA table_info(chat_spaces)").all());
console.log('chat_space_members:', db.prepare("PRAGMA table_info(chat_space_members)").all());