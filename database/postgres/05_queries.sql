-- =====================================================================
-- DEMO / VIVA QUERIES  (joins, nested queries, aggregates, views, procedures)
-- =====================================================================

-- 1. Eligible scholarships for student 1 (function + joins)
SELECT scholarship_name, amount, deadline_status, days_left FROM fn_eligibility_check(1) WHERE is_eligible;

-- 2. "Almost eligible": students failing exactly ONE criterion (gap analysis - novelty)
SELECT scholarship_name, failed_reasons FROM fn_eligibility_check(1) WHERE array_length(failed_reasons,1) = 1;

-- 3. Average income and CGPA of each course (aggregate + GROUP BY)
SELECT * FROM v_course_summary;

-- 4. Approval rate per scholarship (view with FILTER aggregates)
SELECT scholarship_name, total_applications, approved, rejected, approval_rate FROM v_application_stats ORDER BY approval_rate DESC NULLS LAST;

-- 5. Total money awarded per provider
SELECT * FROM v_provider_distribution ORDER BY total_awarded DESC;

-- 6. Nested query: students who applied to scholarships worth more than the average amount
SELECT DISTINCT st.full_name FROM students st
JOIN applications a ON a.student_id = st.student_id
JOIN scholarships s ON s.scholarship_id = a.scholarship_id
WHERE s.amount > (SELECT AVG(amount) FROM scholarships);

-- 7. Correlated subquery: students with NO application yet
SELECT full_name FROM students st WHERE NOT EXISTS (SELECT 1 FROM applications a WHERE a.student_id = st.student_id);

-- 8. HAVING: scholarships with more than one application
SELECT s.name, COUNT(*) AS apps FROM applications a JOIN scholarships s USING (scholarship_id) GROUP BY s.name HAVING COUNT(*) > 1;

-- 9. Expiring / upcoming scholarships (deadline tracking)
SELECT name, deadline, days_left, deadline_status FROM v_scholarship_status WHERE deadline_status IN ('Expiring Soon','Upcoming') ORDER BY deadline;

-- 10. Document checklist across every scholarship a student is eligible for (novelty)
SELECT d.doc_name, COUNT(*) AS needed_for
FROM fn_eligibility_check(2) f
JOIN scholarship_documents sd ON sd.scholarship_id = f.scholarship_id
JOIN document_types d ON d.doc_type_id = sd.doc_type_id
WHERE f.is_eligible GROUP BY d.doc_name ORDER BY needed_for DESC;

-- 11. Window function: rank scholarships by amount inside each provider
SELECT provider_name, name, amount, RANK() OVER (PARTITION BY provider_name ORDER BY amount DESC) AS rnk FROM v_scholarship_status;

-- 12. Trigger demo: audit trail
SELECT * FROM status_history ORDER BY changed_at DESC LIMIT 10;

-- 13. Procedure demo (transaction):  CALL sp_apply_scholarship(5, 7, NULL);   -- student 5 (Arjun) -> fails: CGPA below 9.0
-- 14. Trigger demo (rejects):  UPDATE applications SET status='Approved' WHERE application_id=3;  -- docs not verified
