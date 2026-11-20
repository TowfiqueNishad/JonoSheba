# Ministry & Government Directory Import Spec (`data/imports/ministries/`)

Drop official Cabinet Division allocation lists, National Portal (`bangladesh.gov.bd`) ministry contact tables, or saved officer pages into `data/imports/ministries/` as JSON or CSV UTF-8.

## Rule C1 & C4 Enforcement
- Every record must cite an official `sourceUrl` (`*.gov.bd`) and `asOf` verification timestamp.
- Only official designation, incumbent name, **OFFICE phone**, and official email published for the post are imported.
- Any personal mobile number pattern (`+8801[3-9]...` or `01[3-9]...` not marked as an official agency call-centre helpline) is automatically stripped by `scripts/ingest/orgs/import-ministries.ts`.
