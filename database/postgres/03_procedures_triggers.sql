-- =====================================================================
-- STORED PROCEDURES (transactions) + TRIGGERS
-- =====================================================================

-- ---------- TRIGGER FUNCTIONS ----------
-- T1: block applications outside the open window / to inactive scholarships
CREATE OR REPLACE FUNCTION trg_fn_check_application_window() RETURNS trigger AS $$
DECLARE v_start DATE; v_deadline DATE; v_active BOOLEAN;
BEGIN
  SELECT application_start, deadline, is_active INTO v_start, v_deadline, v_active
  FROM scholarships WHERE scholarship_id = NEW.scholarship_id;
  IF NOT v_active THEN RAISE EXCEPTION 'This scholarship is not active'; END IF;
  IF CURRENT_DATE < v_start THEN RAISE EXCEPTION 'Applications open on %', v_start; END IF;
  IF CURRENT_DATE > v_deadline THEN RAISE EXCEPTION 'Deadline passed on %', v_deadline; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_application_window BEFORE INSERT ON applications
FOR EACH ROW EXECUTE FUNCTION trg_fn_check_application_window();

-- T2: cannot approve unless every required document is Verified
CREATE OR REPLACE FUNCTION trg_fn_require_verified_docs() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'Approved' AND OLD.status IS DISTINCT FROM 'Approved' THEN
    IF EXISTS (SELECT 1 FROM application_documents
               WHERE application_id = NEW.application_id AND verification_status <> 'Verified') THEN
      RAISE EXCEPTION 'Cannot approve: all required documents must be verified first';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_require_verified_docs BEFORE UPDATE OF status ON applications
FOR EACH ROW EXECUTE FUNCTION trg_fn_require_verified_docs();

-- T3: automatic audit trail of status changes
CREATE OR REPLACE FUNCTION trg_fn_status_history() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO status_history(application_id, old_status, new_status, changed_by)
    VALUES (NEW.application_id, NULL, NEW.status, NULL);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO status_history(application_id, old_status, new_status, changed_by)
    VALUES (NEW.application_id, OLD.status, NEW.status, NEW.reviewed_by);
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_status_history AFTER INSERT OR UPDATE OF status ON applications
FOR EACH ROW EXECUTE FUNCTION trg_fn_status_history();

-- T4: an award can only exist for an Approved application
CREATE OR REPLACE FUNCTION trg_fn_award_check() RETURNS trigger AS $$
BEGIN
  IF (SELECT status FROM applications WHERE application_id = NEW.application_id) <> 'Approved' THEN
    RAISE EXCEPTION 'Awards can only be created for approved applications';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_award_check BEFORE INSERT ON awards
FOR EACH ROW EXECUTE FUNCTION trg_fn_award_check();

-- T5: a document can only be verified/rejected after it has been submitted
CREATE OR REPLACE FUNCTION trg_fn_doc_check() RETURNS trigger AS $$
BEGIN
  IF NEW.verification_status IN ('Verified','Rejected') AND NEW.file_name IS NULL THEN
    RAISE EXCEPTION 'Cannot verify a document that has not been submitted';
  END IF;
  IF NEW.verification_status IN ('Verified','Rejected') AND NEW.verified_at IS NULL THEN
    NEW.verified_at := now();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_doc_check BEFORE UPDATE ON application_documents
FOR EACH ROW EXECUTE FUNCTION trg_fn_doc_check();

-- T6: keep students.updated_at fresh
CREATE OR REPLACE FUNCTION trg_fn_touch_student() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_student BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION trg_fn_touch_student();

-- ---------- STORED PROCEDURES ----------
-- P1: apply for a scholarship (eligibility check + application + required-document slots) in one transaction
CREATE OR REPLACE PROCEDURE sp_apply_scholarship(
  p_student_id INT, p_scholarship_id INT, INOUT p_application_id INT DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE v_ok BOOLEAN; v_status TEXT; v_reasons TEXT[];
BEGIN
  SELECT is_eligible, deadline_status, failed_reasons INTO v_ok, v_status, v_reasons
  FROM fn_eligibility_check(p_student_id) f WHERE f.scholarship_id = p_scholarship_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Scholarship not found or already closed'; END IF;
  IF v_status = 'Upcoming' THEN RAISE EXCEPTION 'Applications for this scholarship have not opened yet'; END IF;
  IF NOT v_ok THEN RAISE EXCEPTION 'Not eligible: %', array_to_string(v_reasons, '; '); END IF;

  INSERT INTO applications(student_id, scholarship_id) VALUES (p_student_id, p_scholarship_id)
  RETURNING application_id INTO p_application_id;

  INSERT INTO application_documents(application_id, doc_type_id)
  SELECT p_application_id, sd.doc_type_id FROM scholarship_documents sd
  WHERE sd.scholarship_id = p_scholarship_id;
END $$;

-- P2: review an application (Under Review / Approved / Rejected). Approval creates the award atomically.
CREATE OR REPLACE PROCEDURE sp_review_application(
  p_application_id INT, p_officer_id INT, p_new_status TEXT,
  p_remarks TEXT DEFAULT NULL, p_payment_mode TEXT DEFAULT 'DBT')
LANGUAGE plpgsql AS $$
DECLARE v_cur TEXT; v_amount NUMERIC;
BEGIN
  IF p_new_status NOT IN ('Under Review','Approved','Rejected') THEN
    RAISE EXCEPTION 'Invalid status %', p_new_status;
  END IF;

  SELECT a.status, s.amount INTO v_cur, v_amount
  FROM applications a JOIN scholarships s ON s.scholarship_id = a.scholarship_id
  WHERE a.application_id = p_application_id FOR UPDATE OF a;

  IF NOT FOUND THEN RAISE EXCEPTION 'Application % not found', p_application_id; END IF;
  IF v_cur IN ('Approved','Rejected') THEN
    RAISE EXCEPTION 'Application is already % and cannot be changed', v_cur;
  END IF;

  UPDATE applications SET status = p_new_status, reviewed_by = p_officer_id, remarks = p_remarks
  WHERE application_id = p_application_id;           -- fires T2 + T3

  IF p_new_status = 'Approved' THEN
    INSERT INTO awards(application_id, amount, payment_mode, transaction_ref)
    VALUES (p_application_id, v_amount, p_payment_mode,
            'TXN' || to_char(now(),'YYYYMMDD') || lpad(p_application_id::text, 6, '0'));
  END IF;
END $$;
