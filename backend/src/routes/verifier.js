const router = require('express').Router();
const pool = require('../config/postgres');
const auth = require('../middleware/auth');
const { wrap } = require('../utils/helpers');
const { logActivity, notify } = require('../utils/logger');

const STAFF = ['verifier', 'admin', 'sysadmin'];

// GET /api/verifier/queue?status=open|all
router.get('/queue', auth(STAFF), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.application_id, a.status, a.applied_on, st.full_name, st.course, st.cgpa,
            st.annual_income, st.category, s.name AS scholarship_name, s.amount,
            COUNT(ad.app_doc_id)::int AS total_docs,
            COUNT(*) FILTER (WHERE ad.verification_status = 'Verified')::int AS verified_docs,
            COUNT(*) FILTER (WHERE ad.verification_status = 'Pending')::int  AS pending_docs
     FROM applications a
     JOIN students st ON st.student_id = a.student_id
     JOIN scholarships s ON s.scholarship_id = a.scholarship_id
     LEFT JOIN application_documents ad ON ad.application_id = a.application_id
     WHERE ($1 = 'all' OR a.status IN ('Submitted','Under Review'))
     GROUP BY a.application_id, st.student_id, s.scholarship_id
     ORDER BY a.applied_on`, [req.query.status || 'open']);
  res.json(rows);
}));

// GET /api/verifier/applications/:id
router.get('/applications/:id', auth(STAFF), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const app = await pool.query(
    `SELECT a.*, st.full_name, st.course, st.year_of_study, st.cgpa, st.annual_income, st.category, st.state,
            s.name AS scholarship_name, s.amount
     FROM applications a JOIN students st ON st.student_id = a.student_id
     JOIN scholarships s ON s.scholarship_id = a.scholarship_id WHERE a.application_id = $1`, [id]);
  if (!app.rows[0]) return res.status(404).json({ error: 'Not found' });
  const docs = await pool.query(
    `SELECT ad.app_doc_id, d.doc_name, ad.file_name, ad.verification_status, ad.submitted_on
     FROM application_documents ad JOIN document_types d ON d.doc_type_id = ad.doc_type_id
     WHERE ad.application_id = $1 ORDER BY d.doc_name`, [id]);
  res.json({ ...app.rows[0], documents: docs.rows });
}));

// PATCH /api/verifier/documents/:appDocId  { status: 'Verified' | 'Rejected' }
router.patch('/documents/:appDocId', auth(['verifier', 'admin']), wrap(async (req, res) => {
  const { status } = req.body;
  if (!['Verified', 'Rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const r = await pool.query(
    `UPDATE application_documents SET verification_status = $1, verified_by = $2, verified_at = now()
     WHERE app_doc_id = $3 RETURNING application_id`, [status, req.user.id, req.params.appDocId]);
  if (!r.rowCount) return res.status(404).json({ error: 'Document not found' });
  const u = await pool.query(
    `SELECT st.user_id FROM applications a JOIN students st ON st.student_id = a.student_id
     WHERE a.application_id = $1`, [r.rows[0].application_id]);
  notify(u.rows[0].user_id, `Document ${status.toLowerCase()}`,
         `A document on application #${r.rows[0].application_id} was ${status.toLowerCase()}.`,
         status === 'Verified' ? 'success' : 'warning');
  logActivity(req.user, 'DOC_' + status.toUpperCase(), 'application', r.rows[0].application_id);
  res.json({ ok: true });
}));

// POST /api/verifier/applications/:id/review { status, remarks, payment_mode }
// -> stored procedure (transaction). Approval creates the award; triggers enforce document verification.
router.post('/applications/:id/review', auth(['verifier', 'admin']), wrap(async (req, res) => {
  const { status, remarks, payment_mode } = req.body;
  const id = Number(req.params.id);
  await pool.query('CALL sp_review_application($1, $2, $3, $4, $5)',
                   [id, req.user.id, status, remarks || null, payment_mode || 'DBT']);
  const u = await pool.query(
    `SELECT st.user_id, s.name FROM applications a JOIN students st ON st.student_id = a.student_id
     JOIN scholarships s ON s.scholarship_id = a.scholarship_id WHERE a.application_id = $1`, [id]);
  notify(u.rows[0].user_id, `Application ${status}`,
         `Your application for "${u.rows[0].name}" is now: ${status}.${remarks ? ' Remarks: ' + remarks : ''}`,
         status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'info');
  logActivity(req.user, 'REVIEW_' + status.replace(' ', '_').toUpperCase(), 'application', id, { remarks });
  res.json({ ok: true });
}));

// GET /api/verifier/awards
router.get('/awards', auth(STAFF), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT aw.*, st.full_name, s.name AS scholarship_name
     FROM awards aw JOIN applications a ON a.application_id = aw.application_id
     JOIN students st ON st.student_id = a.student_id
     JOIN scholarships s ON s.scholarship_id = a.scholarship_id ORDER BY aw.award_id DESC`);
  res.json(rows);
}));

// PATCH /api/verifier/awards/:id/pay
router.patch('/awards/:id/pay', auth(['verifier', 'admin']), wrap(async (req, res) => {
  const r = await pool.query(
    `UPDATE awards SET payment_status = 'Paid', payment_date = CURRENT_DATE
     WHERE award_id = $1 AND payment_status = 'Pending' RETURNING application_id`, [req.params.id]);
  if (!r.rowCount) return res.status(400).json({ error: 'Award not found or already paid' });
  const u = await pool.query(
    `SELECT st.user_id FROM applications a JOIN students st ON st.student_id = a.student_id
     WHERE a.application_id = $1`, [r.rows[0].application_id]);
  notify(u.rows[0].user_id, 'Payment released', 'Your scholarship amount has been paid.', 'success');
  logActivity(req.user, 'AWARD_PAID', 'award', Number(req.params.id));
  res.json({ ok: true });
}));

module.exports = router;
