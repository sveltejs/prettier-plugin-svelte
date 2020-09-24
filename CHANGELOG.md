# prettier-plugin-svelte changelog

## 1.3.0

* Add `vscodeLanguageIds` for VS Code consumers, including coc-prettier ([#138](https://github.com/sveltejs/prettier-plugin-svelte/issues/138))
* Keep comments directly before `<style>`, `<script>` or `<template>` tags together with the tag when reformatting ([#137](https://github.com/sveltejs/prettier-plugin-svelte/issues/137))
* Keep inline elements together even when inside text ([#139](https://github.com/sveltejs/prettier-plugin-svelte/issues/139))
* Don't format `class` attributes ([#145](https://github.com/sveltejs/prettier-plugin-svelte/pull/145))

## 1.2.1

* Skip formatting `<style>` or `<script>` tags if in an unsupported language or if `prettier-ignore`d ([#55](https://github.com/sveltejs/prettier-plugin-svelte/issues/55), [#59](https://github.com/sveltejs/prettier-plugin-svelte/issues/59), [#95](https://github.com/sveltejs/prettier-plugin-svelte/issues/95))
* Make error location properties compatible with both Svelte and Prettier ([#71](https://github.com/sveltejs/prettier-plugin-svelte/issues/71))
* Handle/preserve comments in event handlers ([#96](https://github.com/sveltejs/prettier-plugin-svelte/issues/96))
* Fix Node 10 compatibility ([#135](https://github.com/sveltejs/prettier-plugin-svelte/issues/135))

## 1.2.0

* Don't format contents of `<pre>` or its attributes, apart from `class` ([#28](https://github.com/sveltejs/prettier-plugin-svelte/issues/28))
* Fix whitespace issues ([#58](https://github.com/sveltejs/prettier-plugin-svelte/issues/58), [#103](https://github.com/sveltejs/prettier-plugin-svelte/issues/103), [#24](https://github.com/sveltejs/prettier-plugin-svelte/issues/24))
* Add option to disable first level of indentation in `<script>` and `<style>` tags ([#105](https://github.com/sveltejs/prettier-plugin-svelte/issues/105))
* Fix output when rewriting shorthand attributes to not use the shorthand syntax ([#110](https://github.com/sveltejs/prettier-plugin-svelte/issues/110))
* Add support for object destructuring reassignment ([#113](https://github.com/sveltejs/prettier-plugin-svelte/issues/113))

## 1.1.1

* Fix bug that breaks plugin when using Prettier v2.1.x ([#123](https://github.com/sveltejs/prettier-plugin-svelte/issues/123))
* Fix incorrectly escaped regexp which broke style tags followed by "s" ([#118](https://github.com/sveltejs/prettier-plugin-svelte/issues/118))
* Write to console.error to prevent crash and erasion of files ([#115](https://github.com/sveltejs/prettier-plugin-svelte/issues/115))

## 1.1.0

* Support `<!-- prettier-ignore -->` comments ([#59](https://github.com/sveltejs/prettier-plugin-svelte/issues/59))
* Fix `{#await}` printing with `{:catch}` but no pending block ([#76](https://github.com/sveltejs/prettier-plugin-svelte/pull/76))
* Fix `{#await}` printing with only a pending block ([#77](https://github.com/sveltejs/prettier-plugin-svelte/pull/77))
* Support `{#await}` destructuring ([#83](https://github.com/sveltejs/prettier-plugin-svelte/pull/83))
* Fix other `{#await}` handling in Svelte versions since 3.20 ([#83](https://github.com/sveltejs/prettier-plugin-svelte/pull/83))

## 1.0.0

* Support Prettier 2
* Add `svelteAllowShorthand` option
* This plugin has now become an official Svelte project

## 0.7.0

* Add `svelteStrictMode` option
* Support `{#await}` block shorthand syntax

## 0.6.0

* Support nested `<script>` and `<style>` tags
* Add `svelteSortOrder` option
* Fix printing of HTML entities
* Add option to add newline to closing angle bracket
* Support all `<svelte:*>` elements
* Throw Svelte parsing errors in format Prettier expects
* Add handling for `|local` transition modifier
* Prevent `{#if}` blocks nested in an `{#each}`/`{:else}` from being converted into an `{:else if}`
* Fix whitespace trimming for lonely wrapped mustache tags

## 0.5.1

* Fix attribute wrapping

## 0.5.0

* Remove .html from list of extensions
* Use `typescript` as parser to handle both JS and TS
* Add support for event modifiers
* Support Unicode content in `<script>` and `<style>` blocks
* Don't print children for empty elements
* Improve handling of text nodes
* Prevent extra whitespace for `<script>`-only templates
* Correctly collapse empty elements
* Improve directive support

## 0.4.2

* Fix script + css and script + module printing

## 0.4.1

* Print HTML last

## 0.4.0

* Drop support for v2 and fully support v3
* Make Prettier and Svelte peer deps
