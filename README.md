# ScholarHub - Student Scholarship Management & Eligibility System

Node.js/Express API + vanilla-JS frontend, using **PostgreSQL (pgAdmin)** as the relational database and **MongoDB** as the NoSQL database.

```
scholarship-system/
├── database/
│   ├── postgres/   01_schema.sql · 02_views_functions.sql · 03_procedures_triggers.sql · 04_seed.sql · 05_queries.sql
│   └── mongodb/    seed_data.json · README.md
├── backend/        Express API (src/routes, src/models, src/config, scripts)
└── frontend/       index.html · css/ · js/   (served by the backend)
```

## Setup (one time)
1. **PostgreSQL / pgAdmin** - create an empty database named `scholarship_db`. Open *Query Tool* on it and run, in order:
   `01_schema.sql` → `02_views_functions.sql` → `03_procedures_triggers.sql` → `04_seed.sql`
   (or run `npm run db:init` from `backend/` after step 3).
2. **MongoDB** - make sure MongoDB is running (default `mongodb://127.0.0.1:27017`).
3. **Backend**
   ```
   cd backend
   copy .env.example .env      (Linux/Mac: cp .env.example .env)   -> put your pgAdmin password in PG_PASSWORD
   npm install
   npm run db:seed-mongo       # loads NoSQL sample data
   npm start
   ```
4. Open **http://localhost:5000**

## Demo logins (password `password123`)
| Role | Email |
|---|---|
| Student | ganikhasri@student.in · diya@student.in · rahul@student.in |
| Verification Officer | verifier@scholar.in |
| Administrator | admin@scholar.in |
| System Administrator | sysadmin@scholar.in |

## Faculty requirement checklist
| Requirement | Where |
|---|---|
| Min 5 tables in ER diagram | 11 tables: users, students, providers, scholarships, eligibility_criteria, document_types, scholarship_documents, applications, application_documents, awards, status_history |
| RDBMS + NoSQL | PostgreSQL (core transactional data) + MongoDB (scholarship extras/FAQs, reviews, activity logs, notifications) |
| Reports in demo | **Reports** page: avg CGPA/income per course, approval rate per scholarship, awards by provider/category/type, monthly applications, deadline tracking |
| Novelty | (1) **Gap analysis** - "almost eligible" scholarships with the exact failed criterion; (2) **Priority score** ranking by amount vs. urgency; (3) **Smart document checklist** - one consolidated list across all eligible scholarships. Eligibility is pure SQL rules (no AI/LLM). |

## DBMS concepts demonstrated
Primary/foreign keys, CHECK/UNIQUE constraints, joins, nested & correlated subqueries, aggregates (GROUP BY/HAVING, FILTER), window functions, 5 views, SQL function `fn_eligibility_check`, stored procedures `sp_apply_scholarship` / `sp_review_application` (transactions), 6 triggers (deadline window, document-verified-before-approval, status audit trail, award guard, document check, updated_at), indexes. See `database/postgres/05_queries.sql` for viva-ready queries.

## Notes
- File "upload" stores the file name only (demo); plug in `multer` for real storage.
- `NULL` in an eligibility array column (categories/genders/states/courses) or `max_income` means "no restriction".
