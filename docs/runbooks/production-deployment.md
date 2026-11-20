# Production Deployment Runbook — Jonoshheba AI

## 1. Pre-Deployment Checklist (Rules R1–R11)
- [ ] All `.env` secrets stored in Kubernetes Secrets / KMS (never committed to git).
- [ ] `APP_ENV=production` fails fast if any `dev_only_*` secret remains (`apps/api` & `apps/ai`).
- [ ] `infra/k8s/networkpolicy-ai-isolation.yaml` applied so `jonoshheba-ai:8000` is unreachable from the public internet.
- [ ] Database migrations (`prisma migrate deploy`) and PostgreSQL RLS policies (`20261119000002_pgvector_trgm_partial_rls`) verified.
- [ ] Verify every external transport provider adapter has explicit `integration_type`; only `OFFICIAL_API | PARTNER_FEED | PERMITTED_FEED` may display `"live"`.
- [ ] Verify all emergency hotlines (`999`, `333`, `16263`, `109`, `1098`, `106`, `102`, `1090`, `16430`) passed two-person review.

## 2. Rollout Steps
1. Apply namespace and network isolation:
   ```bash
   kubectl apply -f infra/k8s/namespace.yaml
   kubectl apply -f infra/k8s/networkpolicy-ai-isolation.yaml
   ```
2. Run database migrations as a one-off Kubernetes Job before app rollout:
   ```bash
   pnpm --filter @jonoshheba/api db:migrate
   ```
3. Deploy workloads and HPA:
   ```bash
   kubectl apply -f infra/k8s/deployments.yaml
   kubectl -n jonoshheba rollout status deployment/jonoshheba-api
   kubectl -n jonoshheba rollout status deployment/jonoshheba-ai
   kubectl -n jonoshheba rollout status deployment/jonoshheba-web
   ```
4. Run k6 SLO check:
   ```bash
   k6 run -e BASE_URL=https://api.jonoshheba.example scripts/load-test.k6.js
   ```

## 3. Rollback Procedure
```bash
kubectl -n jonoshheba rollout undo deployment/jonoshheba-api
kubectl -n jonoshheba rollout undo deployment/jonoshheba-ai
kubectl -n jonoshheba rollout undo deployment/jonoshheba-web
```
