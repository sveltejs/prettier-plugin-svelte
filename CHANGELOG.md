# prettier-plugin-svelte changelog

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
