---
'prettier-plugin-svelte': patch
---

fix: do not add parentheses around a function binding when a block comment comes before it, such as `bind:value={/* a */ get, set}`
