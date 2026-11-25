---
'prettier-plugin-svelte': patch
---

fix: keep the parentheses around a regular expression at the start of a text expression, such as `{(/a/).test(value)}`, so that Svelte can still parse it
