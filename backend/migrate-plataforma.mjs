import { query } from './src/config/database.js';
await query('ALTER TABLE creatives ADD COLUMN IF NOT EXISTS plataforma TEXT');
console.log('coluna plataforma adicionada');
process.exit(0);
