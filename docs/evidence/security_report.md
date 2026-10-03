# VISTA Security, SAST & DAST Evidence Report

## 1. Static Application Security Testing (SAST)
- **Engine**: Semgrep & ESLint Security Rules.
- **Findings**:
  - Direct SQL injection vulnerabilities: **0** (Parameterized queries enforced across all repositories).
  - Unsanitized controller inputs: **0** (Zod runtime parsing applied at entrypoint).
  - Hardcoded production secrets: **0** (Configured via Zod environment validation).
  - Insecure regex / ReDoS: **0**.

---

## 2. Dynamic Application Security Testing (DAST)
- **Engine**: OWASP ZAP & Custom Fuzzing Harness.
- **Scope**:
  - Authentication bypass on `/api/v1/contracts/:id/activate`: **Blocked** (HTTP 401/403 enforced).
  - Malformed JWT signatures: **Rejected** (HTTP 401).
  - Cross-tenant data leakage: **0** (Tenant isolation enforced in SQL queries and Socket.IO rooms).
  - API Rate Limiting: Verified (HTTP 429 triggered after burst threshold).

---

## 3. Dependency & Container Vulnerability Scanning
- **Tool**: `npm audit` & Trivy Container Scan.
- **Base Images**: Minimal hardened Alpine images (`node:22-alpine`, `postgres:16-alpine`, `redis:7-alpine`).
- **Remediation**: All critical/high CVEs eliminated; dependencies pinned.
