---
'prettier-plugin-svelte': patch
---

fix: keep the `)` when a leading comment comes before a parenthesized expression, such as `{/* a */ (value)}`
