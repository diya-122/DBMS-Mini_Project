-- =====================================================================
-- VIEWS + ELIGIBILITY FUNCTION
-- =====================================================================

-- Deadline tracking: Upcoming / Active / Expiring Soon (<= 7 days) / Closed
CREATE OR REPLACE VIEW v_scholarship_status AS
SELECT s.scholarship_id, s.provider_id, s.name, s.description, s.amount, s.scholarship_type,
       s.application_start, s.deadline, s.is_active,
       p.name AS provider_name, p.provider_type,
       CASE WHEN CURRENT_DATE < s.application_start THEN 'Upcoming'
            WHEN CURRENT_DATE > s.deadline          THEN 'Closed'
            WHEN s.deadline - CURRENT_DATE <= 7     THEN 'Expiring Soon'
            ELSE 'Active' END AS deadline_status,
       (s.deadline - CURRENT_DATE) AS days_left
FROM scholarships s
JOIN providers p ON p.provider_id = s.provider_id
WHERE s.is_active;

-- Core eligibility engine: pure SQL rules (no AI/ML).
-- Returns EVERY open scholarship with the list of criteria the student fails.
-- failed_reasons = {} (empty)  => eligible.
CREATE OR REPLACE FUNCTION fn_eligibility_check(p_student_id INT)
RETURNS TABLE (
  scholarship_id INT, scholarship_name VARCHAR, provider_name VARCHAR, amount NUMERIC,
  scholarship_type VARCHAR, application_start DATE, deadline DATE, deadline_status TEXT, days_left INT,
  failed_reasons TEXT[], is_eligible BOOLEAN, already_applied BOOLEAN)
LANGUAGE sql STABLE AS $$
SELECT v.scholarship_id, v.name, v.provider_name, v.amount, v.scholarship_type,
       v.application_start, v.deadline, v.deadline_status, v.days_left,
       r.reasons,
       COALESCE(array_length(r.reasons,1),0) = 0,
       EXISTS (SELECT 1 FROM applications a
               WHERE a.student_id = st.student_id AND a.scholarship_id = v.scholarship_id)
FROM students st
CROSS JOIN v_scholarship_status v
JOIN eligibility_criteria c ON c.scholarship_id = v.scholarship_id
CROSS JOIN LATERAL (
  SELECT array_remove(ARRAY[
    CASE WHEN st.cgpa < c.min_cgpa
         THEN 'CGPA ' || st.cgpa || ' is below the required ' || c.min_cgpa END,
    CASE WHEN c.max_income IS NOT NULL AND st.annual_income > c.max_income
         THEN 'Family income Rs ' || st.annual_income::bigint || ' exceeds the limit of Rs ' || c.max_income::bigint END,
    CASE WHEN c.allowed_categories IS NOT NULL AND NOT (st.category = ANY (c.allowed_categories))
         THEN 'Category ' || st.category || ' not in ' || array_to_string(c.allowed_categories, '/') END,
    CASE WHEN c.allowed_genders IS NOT NULL AND NOT (st.gender = ANY (c.allowed_genders))
         THEN 'Open only to ' || array_to_string(c.allowed_genders, '/') END,
    CASE WHEN c.allowed_states IS NOT NULL AND NOT (st.state = ANY (c.allowed_states))
         THEN 'State ' || st.state || ' not in ' || array_to_string(c.allowed_states, '/') END,
    CASE WHEN c.allowed_courses IS NOT NULL AND NOT (st.course = ANY (c.allowed_courses))
         THEN 'Course ' || st.course || ' not in ' || array_to_string(c.allowed_courses, '/') END,
    CASE WHEN st.year_of_study < c.min_year OR st.year_of_study > c.max_year
         THEN 'Year ' || st.year_of_study || ' outside allowed years ' || c.min_year || '-' || c.max_year END,
    CASE WHEN c.disability_required AND NOT st.is_disabled
         THEN 'Requires a disability certificate' END,
    CASE WHEN c.minority_required AND NOT st.is_minority
         THEN 'Only for minority community students' END
  ], NULL) AS reasons
) r
WHERE st.student_id = p_student_id
  AND v.deadline_status <> 'Closed';
$$;

-- ---------- REPORT VIEWS ----------
CREATE OR REPLACE VIEW v_application_stats AS
SELECT s.scholarship_id, s.name AS scholarship_name, p.name AS provider_name,
       COUNT(a.application_id)                              AS total_applications,
       COUNT(*) FILTER (WHERE a.status = 'Submitted')       AS submitted,
       COUNT(*) FILTER (WHERE a.status = 'Under Review')    AS under_review,
       COUNT(*) FILTER (WHERE a.status = 'Approved')        AS approved,
       COUNT(*) FILTER (WHERE a.status = 'Rejected')        AS rejected,
       ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'Approved')
             / NULLIF(COUNT(*) FILTER (WHERE a.status IN ('Approved','Rejected')), 0), 1) AS approval_rate
FROM scholarships s
JOIN providers p ON p.provider_id = s.provider_id
LEFT JOIN applications a ON a.scholarship_id = s.scholarship_id
GROUP BY s.scholarship_id, s.name, p.name;

CREATE OR REPLACE VIEW v_provider_distribution AS
SELECT p.provider_id, p.name AS provider_name, p.provider_type,
       COUNT(DISTINCT s.scholarship_id)  AS scholarships_offered,
       COUNT(aw.award_id)                AS awards_given,
       COALESCE(SUM(aw.amount), 0)       AS total_awarded
FROM providers p
LEFT JOIN scholarships s  ON s.provider_id = p.provider_id
LEFT JOIN applications a  ON a.scholarship_id = s.scholarship_id
LEFT JOIN awards aw       ON aw.application_id = a.application_id
GROUP BY p.provider_id, p.name, p.provider_type;

CREATE OR REPLACE VIEW v_course_summary AS      -- "average salary of every department" style report
SELECT course, COUNT(*) AS students,
       ROUND(AVG(cgpa),2) AS avg_cgpa,
       ROUND(AVG(annual_income),0) AS avg_income
FROM students GROUP BY course;
