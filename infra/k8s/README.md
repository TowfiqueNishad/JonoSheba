# Kubernetes Manifests & Helm Charts

Base Kubernetes / Helm deployment manifests for `apps/api`, `apps/ai`, `apps/workers`, `apps/web`, and `apps/admin` will be expanded in **Phase 17 (Deployment & Hardening)**.

Planned structure:
- `base/` — Namespace, ConfigMaps, Deployments, Services, HPA, PDB, NetworkPolicies (restricting `apps/ai` to internal-only traffic from `apps/api` and `apps/workers`).
- `overlays/{dev,staging,prod}/` — Kustomize or Helm values per environment.
