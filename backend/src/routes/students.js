const router = require('express').Router();
const pool = require('../config/postgres');
const auth = require('../middleware/auth');
const { wrap } = require('../utils/helpers');
const { logActivity } = require('../utils/logger');

// GET /api/students/me
router.get('/me', auth(['student']), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, u.email FROM students s JOIN users u ON u.user_id = s.user_id WHERE s.student_id = $1`,
    [req.user.studentId]);
  res.json(rows[0]);
}));

// PUT /api/students/me   (profile changes immediately change eligibility results)
router.put('/me', auth(['student']), wrap(async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `UPDATE students SET full_name=$1, dob=$2, gender=$3, category=$4, state=$5, course=$6,
            year_of_study=$7, cgpa=$8, annual_income=$9, is_disabled=$10, is_minority=$11
     WHERE student_id=$12 RETURNING *`,
    [b.full_name, b.dob || null, b.gender, b.category, b.state, b.course, b.year_of_study,
     b.cgpa, b.annual_income, !!b.is_disabled, !!b.is_minority, req.user.studentId]);
  logActivity(req.user, 'PROFILE_UPDATE', 'student', req.user.studentId, { cgpa: b.cgpa, income: b.annual_income });
  res.json(rows[0]);
}));

// GET /api/students   (staff)
router.get('/', auth(['admin', 'verifier', 'sysadmin']), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, u.email,
            (SELECT COUNT(*)::int FROM applications a WHERE a.student_id = s.student_id) AS applications
     FROM students s JOIN users u ON u.user_id = s.user_id ORDER BY s.full_name`);
  res.json(rows);
}));

module.exports = router;
