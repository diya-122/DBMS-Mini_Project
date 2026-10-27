const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/postgres');
const { wrap } = require('../utils/helpers');
const { logActivity } = require('../utils/logger');

const sign = (u, studentId) =>
  jwt.sign({ id: u.user_id, role: u.role, studentId: studentId || null },
           process.env.JWT_SECRET || 'dev_secret', { expiresIn: '8h' });

// POST /api/auth/login
router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query(
    `SELECT u.*, s.student_id, s.full_name FROM users u
     LEFT JOIN students s ON s.user_id = u.user_id WHERE u.email = $1`, [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  logActivity({ id: u.user_id, role: u.role }, 'LOGIN', 'user', u.user_id);
  res.json({
    token: sign(u, u.student_id),
    user: { id: u.user_id, email: u.email, role: u.role, studentId: u.student_id, name: u.full_name || u.email },
  });
}));

// POST /api/auth/register   (students only) -> creates users + students rows in ONE transaction
router.post('/register', wrap(async (req, res) => {
  const b = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(b.password, 10);
    const u = await client.query(
      `INSERT INTO users(email, password_hash, role) VALUES ($1,$2,'student') RETURNING *`, [b.email, hash]);
    const s = await client.query(
      `INSERT INTO students(user_id, full_name, dob, gender, category, state, course, year_of_study,
                            cgpa, annual_income, is_disabled, is_minority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING student_id`,
      [u.rows[0].user_id, b.full_name, b.dob || null, b.gender, b.category, b.state, b.course,
       b.year_of_study, b.cgpa, b.annual_income, !!b.is_disabled, !!b.is_minority]);
    await client.query('COMMIT');
    logActivity({ id: u.rows[0].user_id, role: 'student' }, 'REGISTER', 'student', s.rows[0].student_id);
    res.status(201).json({
      token: sign(u.rows[0], s.rows[0].student_id),
      user: { id: u.rows[0].user_id, email: b.email, role: 'student', studentId: s.rows[0].student_id, name: b.full_name },
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}));

module.exports = router;
