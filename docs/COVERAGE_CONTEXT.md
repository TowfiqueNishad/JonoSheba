# Jonoshheba AI — Bangladesh Full-Coverage Context & Facts Snapshot (Nov 2026)

*Reference context for Part 2 Coverage Engine prompts (C00–C14). Every fact below is designed to be stored as source-backed **data**, never hard-coded in logic or tests (Rules C1 & C4), and re-verified before launch.*

## 1. Administrative Geography
- **Divisions & Districts:** 8 divisions, 64 districts (data-driven via gazetteer).
- **Upazilas:** Historically 495; NICAR approved 5 new upazilas on 7 May 2026 (→ 500), with earlier approvals referencing 498. Always treat counts as data.
- **City Corporations:** 12 commonly cited; Bogura City Corporation approved May 2026.
- **Pourashavas & Unions:** ~330 pourashavas, ~4,500–4,600 union parishads (4,554 / 4,571 / 4,599 across sources), ~640 police stations (thanas).
- **2018 Spelling Updates:** `Chattogram`, `Barishal`, `Cumilla`, `Jashore`, `Bogura` (retain `Chittagong`, `Barisal`, `Comilla`, `Jessore`, `Bogra` as search aliases).
- **Boundaries Source:** HDX `cod-ab-bgd` (BBS source, admin levels 0–4).

## 2. Bangladesh Railway
- **Network:** ~3,428 km (Railways Minister statement, April 2026).
- **Stations:** ~460–498 depending on source/year; e-ticketing covers a subset (~85/483 reported); ~67 West Zone stations temporarily shut due to manpower shortage → every station stores `status: open | closed_temporarily | closed | halt | under_construction` and `e_ticketing_enabled: boolean`.
- **Official Ticketing Channels:** `https://eticket.railway.gov.bd`, Rail Sheba app, authorised counters; Hotline `131`. Always display fraud warning against unofficial pages (Rule C6). Ticketing vendor contract ends Feb 2027 → store channel URLs as data with `last_verified_at`.
- **Lines & Services:** Eid 100% online advance (specials often counter-only); international trains (Maitree, Bandhan, Mitali — status stored as data); Padma Bridge rail link (Dhaka–Jashore); Dohazari–Cox's Bazar (9 new stations).

## 3. Metro, BRT & Tolls
- **Dhaka MRT Line-6:** 16 operational stations (Uttara North → Motijheel, 20.1 km); Motijheel–Kamalapur 17th station expected ~2027; MRT-1, MRT-5 under construction/approved; MRT-2, MRT-4 planned; Uttara–Tongi 5 stations planned.
- **Tolls & Bridges:** Padma Bridge, Jamuna Bridge, Karnaphuli Tunnel, Dhaka Elevated Expressway, Meghna/Gumti bridges (with `name_history` for post-2024 renamings).

## 4. Public Services & Social Protection
- **myGov:** 1,800+ digitized services across 35 ministries / 178 organisations (a2i); 168 added in 2025; cantonment board services added Oct 2026.
- **National Portal (`bangladesh.gov.bd`):** Ministry, district, upazila, and union office portals with Citizen Charters (সিটিজেন চার্টার).
- **Key Official Gateways:** Land (`land.gov.bd`, `ldtax.gov.bd`, hotline `16122`), Tax e-Return (`www.etaxnbr.gov.bd`, NBR call centre `09643 71 71 71`), e-Passport (`www.epassport.gov.bd`), Birth Reg Verify (`everify.bdris.gov.bd`), BRTA (`https://bsp.brta.gov.bd/`, QR verify `bsp.brta.gov.bd/scan`).
- **Social Protection (FY2026-27):** 90 programmes. **Family Card** (MoSW, launched 10 March 2026): Tk 2,500/month to mother/female head of poor household (1 card/family up to 5 members; merging TCB/Food-Friendly/VWB; 8-category negative list; nationwide census since 1 Aug 2026; 4-year revision cycle).

## 5. Utilities & Verified Hotlines (All Flagged `verify_before_release`)
- **Electricity Distributors:** BPDB `16200` · BREB/Palli Bidyut `16899` (~80 PBS) · DPDC `16116` · DESCO `16120` · NESCO `16603` · WZPDCL `16117`.
- **National Hotlines:** `999` emergency · `333` national helpline · `109` violence against women & children · `1098` child helpline · `16263` health (Shastho Batayon) · `106` ACC · `16430` legal aid · `1090` disaster early warning · `102` fire service · `131` railway · `105` NID · `16122` land.
- **Political & Naming Context:** Many institutions, bridges, programmes, and scholarships were renamed in 2024–2026 → store `name_history` everywhere and match both old & new names in search (Rule C3).
