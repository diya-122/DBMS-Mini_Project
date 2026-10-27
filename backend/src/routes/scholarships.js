const router = require('express').Router();
const pool = require('../config/postgres');
const auth = require('../middleware/auth');
const { wrap } = require('../utils/helpers');
const { ScholarshipExtra, Review } = require('../models');
const { logActivity } = require('../utils/logger');

// GET /api/scholarships?q=&course=&state=&category=&income=&status=&type=&gender=
// Search & filtering: scholarships whose criteria accept the given value (NULL criteria = open to all)
router.get('/', auth(), wrap(async (req, res) => {
  const { q, course, state, category, income, status, type, gender } = req.query;
  const where = []; const p = [];
  const add = (sql, val) => { p.push(val); where.push(sql.replace('?', '$' + p.length)); };

  if (q) { p.push('%' + q + '%'); where.push('(v.name ILIKE $' + p.length + ' OR v.provider_name ILIKE $' + p.length + ')'); }
  if (course)   add('(c.allowed_courses IS NULL OR ? = ANY(c.allowed_courses))', course);
  if (state)    add('(c.allowed_states IS NULL OR ? = ANY(c.allowed_states))', state);
  if (category) add('(c.allowed_categories IS NULL OR ? = ANY(c.allowed_categories))', category);
  if (gender)   add('(c.allowed_genders IS NULL OR ? = ANY(c.allowed_genders))', gender);
  if (income)   add('(c.max_income IS NULL OR c.max_income >= ?)', income);
  if (type)     add('v.scholarship_type = ?', type);
  if (status)   add('v.deadline_status = ?', status);
  else          where.push(`v.deadline_status <> 'Closed'`);

  const { rows } = await pool.query(
    `SELECT v.*, c.min_cgpa, c.max_income, c.allowed_categories, c.allowed_genders,
            c.allowed_states, c.allowed_courses, c.min_year, c.max_year,
            c.disability_required, c.minority_required
     FROM v_scholarship_status v
     JOIN eligibility_criteria c ON c.scholarship_id = v.scholarship_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY v.deadline`, p);
  res.json(rows);
}));

// GET /api/scholarships/:id  -> PostgreSQL (structured) + MongoDB (flexible extras & reviews)
router.get('/:id', auth(), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const sch = await pool.query(
    `SELECT v.*, p.website FROM v_scholarship_status v JOIN providers p ON p.provider_id = v.provider_id
     WHERE v.scholarship_id = $1`, [id]);
  if (!sch.rows[0]) return res.status(404).json({ error: 'Scholarship not found' });
  const crit = await pool.query('SELECT * FROM eligibility_criteria WHERE scholarship_id = $1', [id]);
  const docs = await pool.query(
    `SELECT d.doc_type_id, d.doc_name, d.description FROM scholarship_documents sd
     JOIN document_types d ON d.doc_type_id = sd.doc_type_id WHERE sd.scholarship_id = $1 ORDER BY d.doc_name`, [id]);

  const extra = await ScholarshipExtra.findOne({ scholarshipId: id }).lean();
  const reviews = await Review.find({ scholarshipId: id }).sort({ createdAt: -1 }).limit(20).lean();
  const avg = reviews.length ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  res.json({ ...sch.rows[0], criteria: crit.rows[0], documents: docs.rows, extra, reviews, avg_rating: avg });
}));

// POST /api/scholarships/:id/reviews   (students who applied)  -> MongoDB
router.post('/:id/reviews', auth(['student']), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const applied = await pool.query(
    'SELECT 1 FROM applications WHERE student_id=$1 AND scholarship_id=$2', [req.user.studentId, id]);
  if (!applied.rowCount) return res.status(403).json({ error: 'Only students who applied can leave a review' });
  const me = await pool.query('SELECT full_name FROM students WHERE student_id=$1', [req.user.studentId]);
  const r = await Review.create({
    scholarshipId: id, userId: req.user.id, studentName: me.rows[0].full_name,
    rating: req.body.rating, comment: req.body.comment });
  logActivity(req.user, 'REVIEW_ADDED', 'scholarship', id, { rating: req.body.rating });
  res.status(201).json(r);
}));

module.exports = router;
