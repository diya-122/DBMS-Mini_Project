const router = require('express').Router();
const pool = require('../config/postgres');
const auth = require('../middleware/auth');
const { wrap } = require('../utils/helpers');

const STAFF = ['admin', 'verifier', 'sysadmin'];
const q = (sql) => wrap(async (req, res) => res.json((await pool.query(sql)).rows));

router.get('/summary', auth(STAFF), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM students)                         AS students,
            (SELECT COUNT(*)::int FROM scholarships WHERE is_active)     AS scholarships,
            (SELECT COUNT(*)::int FROM applications)                     AS applications,
            (SELECT COUNT(*)::int FROM applications WHERE status IN ('Submitted','Under Review')) AS pending,
            (SELECT COUNT(*)::int FROM awards)                           AS awards,
            (SELECT COALESCE(SUM(amount),0) FROM awards)                 AS total_awarded,
            (SELECT COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE status='Approved')
                    / NULLIF(COUNT(*) FILTER (WHERE status IN ('Approved','Rejected')),0), 1), 0)
             FROM applications)                                          AS approval_rate`);
  res.json(rows[0]);
}));

// Application statistics + approval rate per scholarship (view)
router.get('/application-stats', auth(STAFF), q(
  `SELECT * FROM v_application_stats WHERE total_applications > 0 ORDER BY total_applications DESC`));

router.get('/status-breakdown', auth(STAFF), q(
  `SELECT status, COUNT(*)::int AS count FROM applications GROUP BY status ORDER BY count DESC`));

// "Average X of every department" style report -> average CGPA / income of each course
router.get('/avg-by-course', auth(STAFF), q(`SELECT * FROM v_course_summary ORDER BY students DESC`));

// Scholarship distribution
router.get('/provider-distribution', auth(STAFF), q(`SELECT * FROM v_provider_distribution ORDER BY total_awarded DESC`));

router.get('/category-distribution', auth(STAFF), q(
  `SELECT st.category, COUNT(DISTINCT st.student_id)::int AS students,
          COUNT(DISTINCT a.application_id)::int AS applications,
          COUNT(aw.award_id)::int AS awards, COALESCE(SUM(aw.amount),0) AS total_awarded
   FROM students st LEFT JOIN applications a ON a.student_id = st.student_id
   LEFT JOIN awards aw ON aw.application_id = a.application_id
   GROUP BY st.category ORDER BY total_awarded DESC`));

router.get('/type-distribution', auth(STAFF), q(
  `SELECT s.scholarship_type, COUNT(DISTINCT s.scholarship_id)::int AS scholarships,
          COUNT(aw.award_id)::int AS awards, COALESCE(SUM(aw.amount),0) AS total_awarded
   FROM scholarships s LEFT JOIN applications a ON a.scholarship_id = s.scholarship_id
   LEFT JOIN awards aw ON aw.application_id = a.application_id
   GROUP BY s.scholarship_type ORDER BY total_awarded DESC`));

router.get('/monthly-applications', auth(STAFF), q(
  `SELECT to_char(date_trunc('month', applied_on), 'Mon YYYY') AS month, COUNT(*)::int AS applications
   FROM applications GROUP BY date_trunc('month', applied_on) ORDER BY date_trunc('month', applied_on)`));

// Deadline tracking: upcoming, active and expiring scholarships with demand
router.get('/deadlines', auth(STAFF), q(
  `SELECT v.scholarship_id, v.name, v.provider_name, v.deadline, v.days_left, v.deadline_status,
          (SELECT COUNT(*)::int FROM applications a WHERE a.scholarship_id = v.scholarship_id) AS applications
   FROM v_scholarship_status v WHERE v.deadline_status <> 'Closed' ORDER BY v.deadline`));

module.exports = router;
