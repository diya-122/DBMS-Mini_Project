-- =====================================================================
-- Student Scholarship Management & Eligibility System
-- PostgreSQL schema  (run in pgAdmin Query Tool on an empty database)
-- Order of execution: 01_schema -> 02_views_functions -> 03_procedures_triggers -> 04_seed
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS status_history, awards, application_documents, applications,
  scholarship_documents, document_types, eligibility_criteria, scholarships,
  providers, students, users CASCADE;

-- 1. USERS (login accounts for all four end-user roles)
CREATE TABLE users (
  user_id        SERIAL PRIMARY KEY,
  email          VARCHAR(120) NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           VARCHAR(15) NOT NULL CHECK (role IN ('student','admin','verifier','sysadmin')),
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

-- 2. STUDENTS (1:1 with users having role = student)
CREATE TABLE students (
  student_id     SERIAL PRIMARY KEY,
  user_id        INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  full_name      VARCHAR(100) NOT NULL,
  dob            DATE,
  gender         VARCHAR(10) NOT NULL CHECK (gender IN ('Male','Female','Other')),
  category       VARCHAR(10) NOT NULL CHECK (category IN ('General','OBC','SC','ST','EWS')),
  state          VARCHAR(50) NOT NULL,
  course         VARCHAR(50) NOT NULL,
  year_of_study  INT NOT NULL CHECK (year_of_study BETWEEN 1 AND 6),
  cgpa           NUMERIC(4,2) NOT NULL CHECK (cgpa BETWEEN 0 AND 10),
  annual_income  NUMERIC(12,2) NOT NULL CHECK (annual_income >= 0),
  is_disabled    BOOLEAN NOT NULL DEFAULT FALSE,
  is_minority    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at     TIMESTAMP NOT NULL DEFAULT now()
);

-- 3. PROVIDERS
CREATE TABLE providers (
  provider_id    SERIAL PRIMARY KEY,
  name           VARCHAR(120) NOT NULL UNIQUE,
  provider_type  VARCHAR(15) NOT NULL CHECK (provider_type IN ('Government','Private','NGO','Institution')),
  website        VARCHAR(200)
);

-- 4. SCHOLARSHIPS
CREATE TABLE scholarships (
  scholarship_id    SERIAL PRIMARY KEY,
  provider_id       INT NOT NULL REFERENCES providers(provider_id),
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  scholarship_type  VARCHAR(15) NOT NULL CHECK (scholarship_type IN ('Merit','Need','Minority','Women','Disability','General')),
  application_start DATE NOT NULL,
  deadline          DATE NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        INT REFERENCES users(user_id),
  CONSTRAINT chk_dates CHECK (deadline > application_start)
);

-- 5. ELIGIBILITY CRITERIA (1:1 with scholarship).  NULL array / NULL max_income = "no restriction"
CREATE TABLE eligibility_criteria (
  criteria_id         SERIAL PRIMARY KEY,
  scholarship_id      INT NOT NULL UNIQUE REFERENCES scholarships(scholarship_id) ON DELETE CASCADE,
  min_cgpa            NUMERIC(4,2) NOT NULL DEFAULT 0,
  max_income          NUMERIC(12,2),
  allowed_categories  TEXT[],
  allowed_genders     TEXT[],
  allowed_states      TEXT[],
  allowed_courses     TEXT[],
  min_year            INT NOT NULL DEFAULT 1,
  max_year            INT NOT NULL DEFAULT 6,
  disability_required BOOLEAN NOT NULL DEFAULT FALSE,
  minority_required   BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT chk_years CHECK (min_year <= max_year)
);

-- 6. DOCUMENT TYPES  and  7. SCHOLARSHIP_DOCUMENTS (M:N)
CREATE TABLE document_types (
  doc_type_id  SERIAL PRIMARY KEY,
  doc_name     VARCHAR(80) NOT NULL UNIQUE,
  description  VARCHAR(200)
);
CREATE TABLE scholarship_documents (
  scholarship_id INT NOT NULL REFERENCES scholarships(scholarship_id) ON DELETE CASCADE,
  doc_type_id    INT NOT NULL REFERENCES document_types(doc_type_id),
  PRIMARY KEY (scholarship_id, doc_type_id)
);

-- 8. APPLICATIONS
CREATE TABLE applications (
  application_id  SERIAL PRIMARY KEY,
  student_id      INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  scholarship_id  INT NOT NULL REFERENCES scholarships(scholarship_id),
  status          VARCHAR(15) NOT NULL DEFAULT 'Submitted'
                    CHECK (status IN ('Submitted','Under Review','Approved','Rejected')),
  applied_on      TIMESTAMP NOT NULL DEFAULT now(),
  reviewed_by     INT REFERENCES users(user_id),
  remarks         TEXT,
  CONSTRAINT uq_student_scholarship UNIQUE (student_id, scholarship_id)
);

-- 9. APPLICATION_DOCUMENTS
CREATE TABLE application_documents (
  app_doc_id           SERIAL PRIMARY KEY,
  application_id       INT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  doc_type_id          INT NOT NULL REFERENCES document_types(doc_type_id),
  file_name            VARCHAR(200),
  submitted_on         TIMESTAMP,
  verification_status  VARCHAR(15) NOT NULL DEFAULT 'Not Submitted'
                         CHECK (verification_status IN ('Not Submitted','Pending','Verified','Rejected')),
  verified_by          INT REFERENCES users(user_id),
  verified_at          TIMESTAMP,
  CONSTRAINT uq_app_doc UNIQUE (application_id, doc_type_id)
);

-- 10. AWARDS
CREATE TABLE awards (
  award_id        SERIAL PRIMARY KEY,
  application_id  INT NOT NULL UNIQUE REFERENCES applications(application_id),
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_mode    VARCHAR(15) NOT NULL CHECK (payment_mode IN ('Bank Transfer','UPI','Cheque','DBT')),
  payment_status  VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending','Paid')),
  payment_date    DATE,
  transaction_ref VARCHAR(40) UNIQUE
);

-- 11. STATUS_HISTORY (filled automatically by trigger)
CREATE TABLE status_history (
  history_id      SERIAL PRIMARY KEY,
  application_id  INT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  old_status      VARCHAR(15),
  new_status      VARCHAR(15) NOT NULL,
  changed_by      INT REFERENCES users(user_id),
  changed_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for common filters / joins
CREATE INDEX idx_students_course   ON students(course);
CREATE INDEX idx_sch_deadline      ON scholarships(deadline);
CREATE INDEX idx_app_student       ON applications(student_id);
CREATE INDEX idx_app_scholarship   ON applications(scholarship_id);
CREATE INDEX idx_app_status        ON applications(status);
CREATE INDEX idx_appdoc_app        ON application_documents(application_id);
