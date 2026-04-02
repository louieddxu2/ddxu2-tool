# delivery-wizard agent notes

## Working agreement
- Prefer editing `index.html` only (this tool is intended to be maintained as a single-file app).
- **Do not edit** `vendor/*` in normal feature work.

## Vendor policy
- `vendor/` contains third-party libraries pinned to specific versions for offline stability.
- If a vendor upgrade is needed, replace the entire vendor file with the upstream minified build and keep the filename versioned (e.g. `dexie-3.2.4.min.js` → `dexie-3.2.5.min.js`).
- Avoid “small tweaks” inside vendor files; put app changes in `index.html` instead.

