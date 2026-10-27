const { Pool, types } = require('pg');

// Return DATE columns as plain 'YYYY-MM-DD' strings (avoids timezone shifts) and COUNT() bigint as numbers
types.setTypeParser(1082, (v) => v);
types.setTypeParser(20, (v) => parseInt(v, 10));

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'scholarship_db',
});

pool.on('error', (err) => console.error('[PostgreSQL] idle client error', err.message));

module.exports = pool;
