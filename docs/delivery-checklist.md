# Delivery Checklist — Initial Foundation

## What is delivered

| Area | Delivered capability | Verification status |
| --- | --- | --- |
| Architecture | System architecture, ERD, posting rules, permissions, ZATCA connector design, security and roadmap documents | Reviewed in project files |
| Data model | 31 relational tables for tenancy, company data, permissions, sales, journals, compliance, documents, audit logs and Outbox events | Migration applied; 32 tables including migration metadata exist |
| Accounting core | Deterministic decimal invoice calculation, structural pre-issue checks, and balanced journal validation | Unit tested |
| Web experience | Arabic-first RTL dashboard, Sales / Invoice-check page, Accounting balance-check page, Tax center, Document Room and Company Setup | Verified in desktop preview |
| Quality | TypeScript check, Vitest suite and production build | Passed on 15 August 2026 |

## RTL and responsive review

| Screen | Desktop 1280 px | Mobile 375 px | Technical/LTR review |
| --- | --- | --- | --- |
| Dashboard | Required sidebar, cards and executive summary verified | Verified at 375 px | Numerical placeholders explicitly LTR |
| Sales | Invoice form and validation result verified | Verified at 375 px | Invoice number, seller tax number and monetary inputs LTR |
| Accounting | Journal balance form and result verified | Verified at 375 px | Debit/credit entry and currency outputs LTR |
| Company Setup | Workspace creation wizard verified | Verified at 375 px | Tenant slug and English legal name LTR |

## Limitations and acceptance boundary

This delivery is an implementation foundation, not a production-complete accounting or tax system. It deliberately does not claim official ZATCA certification or create real FATOORA submissions. Document upload, full customer/quotation/invoice CRUD, posting workflows, role assignment UI, bank reconciliation, AI document extraction, scheduled alerts, and financial reports remain controlled backlog items in `todo.md`. The financial rules and official compliance setup must be reviewed with qualified Saudi accounting and tax professionals before real company data, filing, or production integration is used.
