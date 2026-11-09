import { Client } from 'pg';

import { databaseUrl } from './lib/env.mjs';

const client = new Client({
  connectionString: databaseUrl(),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const highlights = {
  vibra: [
    { id: 'hl-vibra-fotos', label: 'Fotos', icon: 'camera' },
    { id: 'hl-vibra-cafe', label: 'Café', icon: 'coffee' },
    { id: 'hl-vibra-viagens', label: 'Viagens', icon: 'plane' },
    { id: 'hl-vibra-musica', label: 'Música', icon: 'music' },
  ],
  'ana.souza': [
    { id: 'hl-ana-fotos', label: 'Fotos', icon: 'camera' },
    { id: 'hl-ana-arte', label: 'Arte', icon: 'palette' },
    { id: 'hl-ana-cafe', label: 'Café', icon: 'coffee' },
  ],
  'bruno.dev': [
    { id: 'hl-bruno-trilhas', label: 'Trilhas', icon: 'plane' },
    { id: 'hl-bruno-games', label: 'Games', icon: 'gamepad' },
    { id: 'hl-bruno-corrida', label: 'Corrida', icon: 'dumbbell' },
  ],
  'carla.arte': [
    { id: 'hl-carla-arte', label: 'Arte', icon: 'palette' },
    { id: 'hl-carla-filmes', label: 'Filmes', icon: 'crown' },
  ],
  'diego.foto': [
    { id: 'hl-diego-fotos', label: 'Fotos', icon: 'camera' },
    { id: 'hl-diego-praia', label: 'Praia', icon: 'plane' },
  ],
};

for (const [username, list] of Object.entries(highlights)) {
  await client.query('UPDATE public.users SET highlights = $1 WHERE username = $2', [
    JSON.stringify(list),
    username,
  ]);
}

const rows = await client.query(
  'SELECT username, points, highlights FROM public.users WHERE username = ANY($1) ORDER BY id',
  [Object.keys(highlights)],
);
console.log(JSON.stringify(rows.rows, null, 2));

// conferir hash de senha do vibra
const hash = await client.query(
  "SELECT username, LEFT(password_hash, 40) AS hash FROM public.users WHERE username = 'vibra'",
);
console.log('hash:', JSON.stringify(hash.rows));

await client.end();
