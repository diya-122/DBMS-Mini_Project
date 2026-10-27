// Optional helper: runs the 4 SQL files for you (same as pasting them in pgAdmin's Query Tool).
//   cd backend && npm run db:init
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/postgres');

(async () => {
  const dir = path.join(__dirname, '..', '..', 'database', 'postgres');
  const files = ['01_schema.sql', '02_views_functions.sql', '03_procedures_triggers.sql', '04_seed.sql'];
  try {
    for (const f of files) {
      console.log('Running', f);
      await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
    console.log('PostgreSQL database ready.');
  } catch (e) {
    console.error('FAILED:', e.message);
  } finally { await pool.end(); }
})();
