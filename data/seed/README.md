# Seed Data (`data/seed`)

Realistic Bangladesh seed datasets are loaded in **Phase 02** via `pnpm db:seed`:
- 8 divisions, 64 districts, 495 upazilas (with `name_bn`, `name_en`, BBS codes)
- ~50 major Bangladesh Railway stations & ~100 bus stops
- 60+ real citizen services (Bangla + English) with verified official source attribution
- Verified emergency hotlines (`999`, `333`, `102`, `1090`, `16430`, `1098`, `109`, `16263`, `106`, flagged `verify_before_release`)
- 20 scholarships & benefit programs with versioned JSON-Logic rules
- Strictly `MOCK` and `LINK_ONLY` transport providers for development
