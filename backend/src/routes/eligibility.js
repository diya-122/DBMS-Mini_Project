const router = require('express').Router();
const pool = require('../config/postgres');
const auth = require('../middleware/auth');
const { wrap } = require('../utils/helpers');

// GET /api/eligibility/me
// Runs the SQL eligibility engine and adds a priority score (amount vs. urgency) - novelty feature #1
router.get('/me', auth(['student']), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT f.*, ROUND(f.amount / SQRT(GREATEST(f.days_left, 1)))::int AS priority_score
     FROM fn_eligibility_check($1) f
     ORDER BY f.is_eligible DESC, priority_score DESC`, [req.user.studentId]);

  const eligible = rows.filter(r => r.is_eligible);
  // novelty feature #2: gap analysis - scholarships missed by exactly ONE criterion
  const almost = rows.filter(r => !r.is_eligible && r.failed_reasons.length === 1);
  res.json({
    eligible,
    almost_eligible: almost,
    not_eligible: rows.filter(r => !r.is_eligible && r.failed_reasons.length > 1),
    potential_amount: eligible.filter(r => !r.already_applied && r.deadline_status !== 'Upcoming')
                              .reduce((s, r) => s + Number(r.amount), 0),
  });
}));

// GET /api/eligibility/me/checklist
// novelty feature #3: ONE consolidated document checklist for every scholarship the student can still apply to
router.get('/me/checklist', auth(['student']), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT d.doc_type_id, d.doc_name, d.description, COUNT(*)::int AS needed_for,
            array_agg(f.scholarship_name ORDER BY f.scholarship_name) AS scholarships
     FROM fn_eligibility_check($1) f
     JOIN scholarship_documents sd ON sd.scholarship_id = f.scholarship_id
     JOIN document_types d ON d.doc_type_id = sd.doc_type_id
     WHERE f.is_eligible AND NOT f.already_applied AND f.deadline_status <> 'Upcoming'
     GROUP BY d.doc_type_id, d.doc_name, d.description
     ORDER BY needed_for DESC, d.doc_name`, [req.user.studentId]);
  res.json(rows);
}));

module.exports = router;
