# PostgreSQL & Redis Backup / Restore Runbook

**Owner:** Jonoshheba AI Platform Operations  
**Applies to:** PostgreSQL 16 (`pgvector` + `pg_trgm`), Redis 7, MinIO object store  
**Compliance:** Rule R3 (no third-party secrets), Rule R9 (data minimization & retention), Rule R10 (citizen data isolation)

---

## 1. Automated Daily Backups

### PostgreSQL (`pg_dump` custom format)
```bash
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="/backups/jonoshheba_$(date -u +%Y%m%dT%H%M%SZ).dump" \
  "$DATABASE_URL"
```

- **Schedule:** Daily at `20:00 UTC` (`02:00 Asia/Dhaka`) + WAL archiving every 5 minutes.
- **Encryption:** AES-256-GCM at rest in S3-compatible bucket (`s3://jonoshheba-backups/postgres/`).
- **Retention:** 30 daily snapshots, 12 monthly snapshots. Expired anonymous chat sessions (`> 90 days`) and crisis turns (redacted immediately at ingestion per Section 1.4) are never retained in plaintext.

---

## 2. Restore & Verification Drill (Weekly Automated Check)

```bash
# 1. Create clean verification database
createdb jonoshheba_restore_verify

# 2. Restore latest custom dump
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --dbname="jonoshheba_restore_verify" \
  "/backups/latest.dump"

# 3. Verify extension integrity and critical table counts
psql "jonoshheba_restore_verify" -c "
  SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');
  SELECT count(*) AS services_count FROM public_services;
  SELECT count(*) AS hotlines_count FROM hotlines;
"
```

---

## 3. Recovery Objectives

| Metric | Target | Verification |
|---|---|---|
| **RPO (Recovery Point Objective)** | `< 15 minutes` | Continuous WAL archiving |
| **RTO (Recovery Time Objective)** | `< 30 minutes` | Automated `pg_restore` drill in CI/staging |
