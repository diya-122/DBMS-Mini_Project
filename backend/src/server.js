require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const express = require('express');
const cors = require('cors');
const pool = require('./config/postgres');
const connectMongo = require('./config/mongo');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/students',      require('./routes/students'));
app.use('/api/scholarships',  require('./routes/scholarships'));
app.use('/api/eligibility',   require('./routes/eligibility'));
app.use('/api/applications',  require('./routes/applications'));
app.use('/api/verifier',      require('./routes/verifier'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));

// Frontend (static)
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Central error handler: converts PostgreSQL errors (constraints, triggers, procedures) into readable messages
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  if (err.code === 'P0001') return res.status(400).json({ error: err.message });           // RAISE EXCEPTION
  if (err.code === '23505') return res.status(409).json({ error: 'That record already exists (duplicate)' });
  if (err.code === '23503') return res.status(400).json({ error: 'Referenced record does not exist / is still in use' });
  if (err.code === '23514' || err.code === '22P02' || err.code === '23502')
    return res.status(400).json({ error: 'Invalid data: ' + err.message });
  res.status(500).json({ error: 'Server error: ' + err.message });
});

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[PostgreSQL] connected');
  } catch (e) {
    console.error('\n[PostgreSQL] connection FAILED:', e.message, '\n -> check PG_* values in backend/.env and that you ran the SQL files in /database/postgres\n');
    process.exit(1);
  }
  try {
    await connectMongo();
  } catch (e) {
    console.error('\n[MongoDB] connection FAILED:', e.message, '\n -> start MongoDB (or fix MONGO_URI in backend/.env)\n');
    process.exit(1);
  }
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`\nScholarship System running ->  http://localhost:${port}\n`));
})();
