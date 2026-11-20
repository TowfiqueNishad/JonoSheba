# Education Hub Import Spec (`data/imports/education/`)

Place official datasets under `data/imports/education/`:
- `banbeis/` — BANBEIS institution lists (`eiin`, `name_bn`, `name_en`, `type`, `level`, `management`, `mpo`, `board`, `division`, `district`, `upazila`, `address`, `phone`, `email`, `website`, `lat`, `lng`) as CSV UTF-8 or JSON.
- `ugc/` — UGC public, private & international university lists (`ugc_id`, `name_bn`, `name_en`, `management`, `established_year`, `website`, `admission_portal`, `district`, `approval_status`). **Note:** Universities do not have BANBEIS EIINs; `eiin` is always `null`.
- `nu/` — National University affiliated colleges (`nu_college_code`, `eiin`, `name_bn`, `name_en`).
- `bteb/` — Bangladesh Technical Education Board institutes (`bteb_code`, `eiin`, `name_bn`, `name_en`).
- `dgme/` — Directorate General of Medical Education medical/dental/nursing institutes.
