const router = require('express').Router();
const pool = require('../config/postgres');
const auth = require('../middleware/auth');
const { wrap } = require('../utils/helpers');
const { ActivityLog } = require('../models');
const { logActivity, notify } = require('../utils/logger');

// POST /api/applications  { scholarship_id }
// Calls the stored procedure: eligibility re-check + insert + required-document slots in one transaction.
router.post('/', auth(['student']), wrap(async (req, res) => {
  const r = await pool.query('CALL sp_apply_scholarship($1, $2, NULL)',
                             [req.user.studentId, req.body.scholarship_id]);
  const appId = r.rows[0].p_application_id;
  logActivity(req.user, 'APPLIED', 'application', appId, { scholarshipId: req.body.scholarship_id });
  notify(req.user.id, 'Application submitted',
         'Your application was submitted. Please upload all required documents.', 'success');
  res.status(201).json({ application_id: appId });
}));

// GET /api/applications/me
router.get('/me', auth(['student']), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.application_id, a.status, a.applied_on, a.remarks,
            s.scholarship_id, s.name AS scholarship_name, s.amount, s.deadline, p.name AS provider_name,
            aw.award_id, aw.amount AS award_amount, aw.payment_status, aw.payment_mode,
            aw.payment_date, aw.transaction_ref,
            COALESCE((SELECT json_agg(json_build_object(
                        'app_doc_id', ad.app_doc_id, 'doc_name', d.doc_name,
                        'file_name', ad.file_name, 'status', ad.verification_status) ORDER BY d.doc_name)
                      FROM application_documents ad JOIN document_types d ON d.doc_type_id = ad.doc_type_id
                      WHERE ad.application_id = a.application_id), '[]') AS documents
     FROM applications a
     JOIN scholarships s ON s.scholarship_id = a.scholarship_id
     JOIN providers p ON p.provider_id = s.provider_id
     LEFT JOIN awards aw ON aw.application_id = a.application_id
     WHERE a.student_id = $1 ORDER BY a.applied_on DESC`, [req.user.studentId]);
  res.json(rows);
}));

// POST /api/applications/documents/:appDocId  { file_name }   (student "uploads" a document)
router.post('/documents/:appDocId', auth(['student']), wrap(async (req, res) => {
  const r = await pool.query(
    `UPDATE application_documents ad
     SET file_name = $1, submitted_on = now(), verification_status = 'Pending', verified_by = NULL, verified_at = NULL
     FROM applications a
     WHERE ad.app_doc_id = $2 AND a.application_id = ad.application_id
       AND a.student_id = $3 AND a.status IN ('Submitted','Under Review')
     RETURNING ad.application_id`, [req.body.file_name, req.params.appDocId, req.user.studentId]);
  if (!r.rowCount) return res.status(400).json({ error: 'Document not found or application already finalised' });
  logActivity(req.user, 'DOCUMENT_UPLOADED', 'application', r.rows[0].application_id, { file: req.body.file_name });
  res.json({ ok: true });
}));

// GET /api/applications/:id/timeline  -> PostgreSQL status history (trigger) + MongoDB activity log
router.get('/:id/timeline', auth(), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role === 'student') {
    const own = await pool.query('SELECT 1 FROM applications WHERE application_id=$1 AND student_id=$2',
                                 [id, req.user.studentId]);
    if (!own.rowCount) return res.status(403).json({ error: 'Not your application' });
  }
  const hist = await pool.query(
    `SELECT old_status, new_status, changed_at FROM status_history WHERE application_id = $1 ORDER BY changed_at`, [id]);
  const events = await ActivityLog.find({ entity: 'application', entityId: id }).sort({ createdAt: 1 }).lean();
  res.json({ status_history: hist.rows, activity: events });
}));

module.exports = router;
