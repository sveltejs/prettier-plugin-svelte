---
'prettier-plugin-svelte': patch
---

fix: keep empty `{:catch}` in `{#await}` blocks (removing it turns a handled rejection into an unhandled one)
