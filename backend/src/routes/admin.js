const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/postgres');
const auth = require('../middleware/auth');
const { wrap } = require('../utils/helpers');
const { ScholarshipExtra, Review, ActivityLog, Notification } = require('../models');
const { logActivity } = require('../utils/logger');

const ADMINS = ['admin', 'sysadmin'];
const arr = (v) => (Array.isArray(v) && v.length ? v : null);       // empty list => NULL => "no restriction"

async function saveScholarship(client, id, b, userId) {
  const c = b.criteria || {};
  const critVals = [c.min_cgpa || 0, c.max_income === '' || c.max_income == null ? null : c.max_income,
    arr(c.allowed_categories), arr(c.allowed_genders), arr(c.allowed_states), arr(c.allowed_courses),
    c.min_year || 1, c.max_year || 6, !!c.disability_required, !!c.minority_required];
  if (id) {
    await client.query(
      `UPDATE scholarships SET provider_id=$1, name=$2, description=$3, amount=$4, scholarship_type=$5,
              application_start=$6, deadline=$7 WHERE scholarship_id=$8`,
      [b.provider_id, b.name, b.description, b.amount, b.scholarship_type, b.application_start, b.deadline, id]);
    await client.query(
      `UPDATE eligibility_criteria SET min_cgpa=$1, max_income=$2, allowed_categories=$3, allowed_genders=$4,
              allowed_states=$5, allowed_courses=$6, min_year=$7, max_year=$8, disability_required=$9,
              minority_required=$10 WHERE scholarship_id=$11`, [...critVals, id]);
    await client.query('DELETE FROM scholarship_documents WHERE scholarship_id=$1', [id]);
  } else {
    const r = await client.query(
      `INSERT INTO scholarships(provider_id, name, description, amount, scholarship_type, application_start, deadline, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING scholarship_id`,
      [b.provider_id, b.name, b.description, b.amount, b.scholarship_type, b.application_start, b.deadline, userId]);
    id = r.rows[0].scholarship_id;
    await client.query(
      `INSERT INTO eligibility_criteria(min_cgpa, max_income, allowed_categories, allowed_genders, allowed_states,
              allowed_courses, min_year, max_year, disability_required, minority_required, scholarship_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [...critVals, id]);
  }
  for (const d of b.document_ids || []) {
    await client.query('INSERT INTO scholarship_documents(scholarship_id, doc_type_id) VALUES ($1,$2)', [id, d]);
  }
  return id;
}

// GET /api/admin/scholarships  (including inactive & closed)
router.get('/scholarships', auth(ADMINS), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, p.name AS provider_name, c.*,
            COALESCE((SELECT json_agg(sd.doc_type_id) FROM scholarship_documents sd WHERE sd.scholarship_id = s.scholarship_id), '[]') AS document_ids,
            (SELECT COUNT(*)::int FROM applications a WHERE a.scholarship_id = s.scholarship_id) AS applications
     FROM scholarships s JOIN providers p ON p.provider_id = s.provider_id
     JOIN eligibility_criteria c ON c.scholarship_id = s.scholarship_id ORDER BY s.deadline DESC`);
  res.json(rows);
}));

// POST /api/admin/scholarships   (scholarship + criteria + documents in ONE transaction)
router.post('/scholarships', auth(ADMINS), wrap(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await saveScholarship(client, null, req.body, req.user.id);
    await client.query('COMMIT');
    // flexible extras live in MongoDB
    const e = req.body.extra || {};
    try {
      await ScholarshipExtra.findOneAndUpdate({ scholarshipId: id },
        { scholarshipId: id, tags: e.tags || [], howToApply: e.howToApply || [], tips: e.tips || [] }, { upsert: true });
    } catch (err) { console.error('[mongo] extras not saved:', err.message); }
    logActivity(req.user, 'SCHOLARSHIP_CREATED', 'scholarship', id, { name: req.body.name });
    res.status(201).json({ scholarship_id: id });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

// PUT /api/admin/scholarships/:id
router.put('/scholarships/:id', auth(ADMINS), wrap(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await saveScholarship(client, Number(req.params.id), req.body, req.user.id);
    await client.query('COMMIT');
    logActivity(req.user, 'SCHOLARSHIP_UPDATED', 'scholarship', Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

// PATCH /api/admin/scholarships/:id/active { is_active }
router.patch('/scholarships/:id/active', auth(ADMINS), wrap(async (req, res) => {
  await pool.query('UPDATE scholarships SET is_active = $1 WHERE scholarship_id = $2', [!!req.body.is_active, req.params.id]);
  logActivity(req.user, req.body.is_active ? 'SCHOLARSHIP_ENABLED' : 'SCHOLARSHIP_DISABLED', 'scholarship', Number(req.params.id));
  res.json({ ok: true });
}));

router.get('/providers', auth(), wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM providers ORDER BY name')).rows);
}));
router.post('/providers', auth(ADMINS), wrap(async (req, res) => {
  const { name, provider_type, website } = req.body;
  const r = await pool.query('INSERT INTO providers(name, provider_type, website) VALUES ($1,$2,$3) RETURNING *',
                             [name, provider_type, website || null]);
  res.status(201).json(r.rows[0]);
}));
router.get('/document-types', auth(), wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM document_types ORDER BY doc_name')).rows);
}));
router.post('/document-types', auth(ADMINS), wrap(async (req, res) => {
  const r = await pool.query('INSERT INTO document_types(doc_name, description) VALUES ($1,$2) RETURNING *',
                             [req.body.doc_name, req.body.description || null]);
  res.status(201).json(r.rows[0]);
}));

// ---------------- System administrator ----------------
router.get('/users', auth(['sysadmin']), wrap(async (req, res) => {
  res.json((await pool.query('SELECT user_id, email, role, created_at FROM users ORDER BY user_id')).rows);
}));
router.post('/users', auth(['sysadmin']), wrap(async (req, res) => {
  const { email, password, role } = req.body;
  if (!['admin', 'verifier', 'sysadmin'].includes(role)) return res.status(400).json({ error: 'Role must be admin, verifier or sysadmin' });
  const r = await pool.query('INSERT INTO users(email, password_hash, role) VALUES ($1,$2,$3) RETURNING user_id, email, role',
                             [email, await bcrypt.hash(password, 10), role]);
  logActivity(req.user, 'STAFF_USER_CREATED', 'user', r.rows[0].user_id, { role });
  res.status(201).json(r.rows[0]);
}));
router.delete('/users/:id', auth(['sysadmin']), wrap(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself' });
  await pool.query('DELETE FROM users WHERE user_id = $1', [req.params.id]);
  logActivity(req.user, 'USER_DELETED', 'user', Number(req.params.id));
  res.json({ ok: true });
}));

// GET /api/admin/system-health  (database integrity overview of BOTH databases)
router.get('/system-health', auth(['sysadmin']), wrap(async (req, res) => {
  const tables = ['users', 'students', 'providers', 'scholarships', 'eligibility_criteria', 'document_types',
                  'scholarship_documents', 'applications', 'application_documents', 'awards', 'status_history'];
  const postgres = {};
  for (const t of tables) postgres[t] = (await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n;
  const orphan = await pool.query(
    `SELECT COUNT(*)::int AS n FROM applications a WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.student_id = a.student_id)`);
  const mongo = {
    scholarship_extras: await ScholarshipExtra.countDocuments(), reviews: await Review.countDocuments(),
    activity_logs: await ActivityLog.countDocuments(), notifications: await Notification.countDocuments() };
  res.json({ postgres, mongo, orphan_applications: orphan.rows[0].n });
}));

// GET /api/admin/logs?action=&limit=   (MongoDB audit log)
router.get('/logs', auth(['sysadmin']), wrap(async (req, res) => {
  const f = req.query.action ? { action: req.query.action } : {};
  res.json(await ActivityLog.find(f).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 100).lean());
}));

module.exports = router;
