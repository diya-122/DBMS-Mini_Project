-- =====================================================================
-- SAMPLE DATA   (all demo passwords = password123)
-- Dates are relative to CURRENT_DATE so the demo always has open scholarships.
-- =====================================================================
INSERT INTO users(email, password_hash, role) VALUES
 ('admin@scholar.in',    crypt('password123', gen_salt('bf')), 'admin'),      -- 1
 ('verifier@scholar.in', crypt('password123', gen_salt('bf')), 'verifier'),   -- 2
 ('sysadmin@scholar.in', crypt('password123', gen_salt('bf')), 'sysadmin');   -- 3

INSERT INTO users(email, password_hash, role)
SELECT e, crypt('password123', gen_salt('bf')), 'student'
FROM unnest(ARRAY['diya@student.in','ganikhasri@student.in','rahul@student.in','ayesha@student.in',
                  'arjun@student.in','priya@student.in','mohit@student.in','sneha@student.in']) WITH ORDINALITY AS t(e, n)
ORDER BY n;                                                                   -- 4..11

INSERT INTO students(user_id, full_name, dob, gender, category, state, course, year_of_study, cgpa, annual_income, is_disabled, is_minority) VALUES
 (4,  'Diya Agarwal',   '2006-03-14','Female','General','Karnataka',     'B.Tech',2,8.90,450000,FALSE,FALSE),
 (5,  'G Ganikhasri',   '2006-07-22','Female','OBC',    'Tamil Nadu',    'B.Tech',2,9.10,280000,FALSE,FALSE),
 (6,  'Rahul Verma',    '2005-01-09','Male',  'SC',     'Uttar Pradesh', 'B.Tech',3,7.40,150000,FALSE,FALSE),
 (7,  'Ayesha Khan',    '2007-05-30','Female','General','Karnataka',     'B.Sc',  1,8.20,220000,FALSE,TRUE),
 (8,  'Arjun Nair',     '2004-11-02','Male',  'General','Kerala',        'B.Tech',4,6.80,800000,FALSE,FALSE),
 (9,  'Priya Singh',    '2006-09-18','Female','ST',     'Jharkhand',     'BA',    2,7.90, 90000,FALSE,FALSE),
 (10, 'Mohit Das',      '2005-12-25','Male',  'OBC',    'West Bengal',   'B.Com', 3,8.50,300000,TRUE, FALSE),
 (11, 'Sneha Reddy',    '2006-02-11','Female','EWS',    'Telangana',     'MBBS',  2,8.00,190000,FALSE,FALSE);

INSERT INTO providers(name, provider_type, website) VALUES
 ('National Scholarship Portal','Government','https://scholarships.gov.in'),   -- 1
 ('Ministry of Minority Affairs','Government','https://minorityaffairs.gov.in'),-- 2
 ('Tata Trusts','Private','https://www.tatatrusts.org'),                       -- 3
 ('Reliance Foundation','Private','https://www.reliancefoundation.org'),      -- 4
 ('Katha Foundation','NGO','https://example.org/katha'),                       -- 5
 ('PES University','Institution','https://pes.edu'),                          -- 6
 ('AICTE','Government','https://www.aicte-india.org');                        -- 7

INSERT INTO document_types(doc_name, description) VALUES
 ('Income Certificate','Issued by Tahsildar / competent authority'),   -- 1
 ('Caste Certificate','Issued by competent authority'),                -- 2
 ('Previous Marksheet','Latest semester / year marksheet'),            -- 3
 ('Aadhaar Card','Government ID proof'),                               -- 4
 ('Bank Passbook','First page showing account number and IFSC'),      -- 5
 ('Disability Certificate','Minimum 40% disability'),                  -- 6
 ('Minority Certificate','Community certificate'),                     -- 7
 ('Bonafide Certificate','Issued by the institution');                -- 8

INSERT INTO scholarships(provider_id, name, description, amount, scholarship_type, application_start, deadline, created_by) VALUES
 (1,'Post Matric Scholarship for SC/ST','Financial aid for SC/ST students from low-income families.',12000,'Need',CURRENT_DATE-30,CURRENT_DATE+40,1),               -- 1
 (1,'Central Sector Merit Scholarship','Merit-based support for high-performing undergraduates.',20000,'Merit',CURRENT_DATE-20,CURRENT_DATE+30,1),                 -- 2
 (7,'Pragati Scholarship for Girls','AICTE scholarship for girls pursuing technical degrees.',50000,'Women',CURRENT_DATE-25,CURRENT_DATE+45,1),                    -- 3
 (2,'Maulana Azad Minority Scholarship','Support for meritorious minority-community students.',30000,'Minority',CURRENT_DATE-15,CURRENT_DATE+25,1),                -- 4
 (3,'Tata Trusts Medical Grant','Grant for medical students facing financial hardship.',75000,'Need',CURRENT_DATE-10,CURRENT_DATE+35,1),                           -- 5
 (4,'Reliance Foundation UG Scholarship','Flagship scholarship for first and second year undergraduates.',200000,'Merit',CURRENT_DATE-12,CURRENT_DATE+20,1),        -- 6
 (6,'PES Merit Excellence Award','Internal award for top academic performers.',40000,'Merit',CURRENT_DATE-5,CURRENT_DATE+50,1),                                    -- 7
 (1,'Disability Empowerment Scholarship','Scholarship for students with disabilities.',25000,'Disability',CURRENT_DATE-18,CURRENT_DATE+28,1),                       -- 8
 (5,'Katha Rural Education Aid','Aid for rural students from low-income families.',15000,'Need',CURRENT_DATE-8,CURRENT_DATE+33,1),                                 -- 9
 (1,'OBC Merit-cum-Means Scholarship','State-linked scholarship for OBC students.',18000,'Need',CURRENT_DATE-14,CURRENT_DATE+22,1),                                 -- 10
 (3,'Tata Women in Tech Fellowship','Fellowship for women in engineering (closing soon!).',60000,'Women',CURRENT_DATE-40,CURRENT_DATE+3,1),                          -- 11
 (4,'Reliance Future Leaders Grant','Opens soon for second-year students.',35000,'General',CURRENT_DATE+10,CURRENT_DATE+60,1),                                      -- 12
 (1,'Legacy Merit Scholarship 2025','Previous cycle (closed).',10000,'Merit',CURRENT_DATE-90,CURRENT_DATE-10,1);                                                     -- 13

INSERT INTO eligibility_criteria(scholarship_id, min_cgpa, max_income, allowed_categories, allowed_genders, allowed_states, allowed_courses, min_year, max_year, disability_required, minority_required) VALUES
 (1, 5.0, 250000, ARRAY['SC','ST'], NULL, NULL, NULL, 1,6, FALSE,FALSE),
 (2, 8.5, 450000, NULL, NULL, NULL, ARRAY['B.Tech','B.Sc','BA','B.Com','MBBS'], 1,6, FALSE,FALSE),
 (3, 6.0, 800000, NULL, ARRAY['Female'], NULL, ARRAY['B.Tech'], 1,4, FALSE,FALSE),
 (4, 6.0, 250000, NULL, NULL, NULL, NULL, 1,6, FALSE,TRUE),
 (5, 7.0, 300000, NULL, NULL, NULL, ARRAY['MBBS'], 1,6, FALSE,FALSE),
 (6, 7.5, 600000, NULL, NULL, NULL, ARRAY['B.Tech','B.Sc'], 1,2, FALSE,FALSE),
 (7, 9.0, NULL,   NULL, NULL, NULL, ARRAY['B.Tech'], 2,4, FALSE,FALSE),
 (8, 5.0, 600000, NULL, NULL, NULL, NULL, 1,6, TRUE,FALSE),
 (9, 5.0, 200000, NULL, NULL, ARRAY['Jharkhand','Bihar','Uttar Pradesh','Odisha'], NULL, 1,6, FALSE,FALSE),
 (10,6.0, 300000, ARRAY['OBC'], NULL, ARRAY['Tamil Nadu','Karnataka','Kerala'], NULL, 1,6, FALSE,FALSE),
 (11,8.0, NULL,   NULL, ARRAY['Female'], NULL, ARRAY['B.Tech'], 1,4, FALSE,FALSE),
 (12,7.0, NULL,   NULL, NULL, NULL, NULL, 2,2, FALSE,FALSE),
 (13,7.0, NULL,   NULL, NULL, NULL, NULL, 1,6, FALSE,FALSE);

-- every scholarship needs Marksheet(3), Aadhaar(4), Bank Passbook(5) ...
INSERT INTO scholarship_documents(scholarship_id, doc_type_id)
SELECT s.scholarship_id, d.doc_type_id FROM scholarships s CROSS JOIN document_types d WHERE d.doc_type_id IN (3,4,5);
-- ... plus scholarship-specific documents
INSERT INTO scholarship_documents(scholarship_id, doc_type_id) VALUES
 (1,1),(1,2),(2,1),(3,1),(3,8),(4,1),(4,7),(5,1),(5,8),(6,1),(6,8),(7,8),(8,1),(8,6),(9,1),(10,1),(10,2),(11,8);

-- ---------- demo applications through the stored procedures ----------
CREATE OR REPLACE FUNCTION fn_seed_application(p_student INT, p_sch INT, p_final TEXT, p_remark TEXT)
RETURNS VOID AS $$
DECLARE v_app INT;
BEGIN
  CALL sp_apply_scholarship(p_student, p_sch, v_app);
  IF p_final = 'Approved' THEN
    UPDATE application_documents SET file_name='sample_document.pdf', submitted_on=now(),
           verification_status='Verified', verified_by=2 WHERE application_id=v_app;
  ELSIF p_final IN ('Under Review','Rejected') THEN
    UPDATE application_documents SET file_name='sample_document.pdf', submitted_on=now(),
           verification_status='Pending' WHERE application_id=v_app;
  END IF;
  IF p_final <> 'Submitted' THEN
    CALL sp_review_application(v_app, 2, p_final, p_remark, 'DBT');
  END IF;
END $$ LANGUAGE plpgsql;

SELECT fn_seed_application(2, 3,  'Approved',     'All documents verified');
SELECT fn_seed_application(1, 3,  'Under Review', 'Verification in progress');
SELECT fn_seed_application(2, 10, 'Submitted',    NULL);
SELECT fn_seed_application(3, 1,  'Approved',     'Eligible and verified');
SELECT fn_seed_application(6, 1,  'Rejected',     'Income certificate mismatch');
SELECT fn_seed_application(4, 4,  'Approved',     'Eligible and verified');
SELECT fn_seed_application(7, 8,  'Under Review', 'Awaiting medical board confirmation');
SELECT fn_seed_application(8, 5,  'Submitted',    NULL);
SELECT fn_seed_application(1, 2,  'Submitted',    NULL);
SELECT fn_seed_application(2, 2,  'Approved',     'Excellent academic record');
SELECT fn_seed_application(7, 2,  'Rejected',     'CGPA verification failed');
SELECT fn_seed_application(3, 9,  'Under Review', 'Verification in progress');
DROP FUNCTION fn_seed_application(INT, INT, TEXT, TEXT);

-- spread application dates over the last months (nice for the monthly report)
UPDATE applications SET applied_on = now() - (application_id * interval '11 days');
UPDATE awards SET payment_status='Paid', payment_date=CURRENT_DATE-2 WHERE award_id IN (1,2);
