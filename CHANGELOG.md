# prettier-plugin-svelte changelog

## 2.2.0

* Add support for `<svelte:fragment>` ([#213](https://github.com/sveltejs/prettier-plugin-svelte/pull/213))

## 2.1.6

* Fix incorrect removal of comment ([#207](https://github.com/sveltejs/prettier-plugin-svelte/issues/207))

## 2.1.5

* Fix retrieval of comment belonging to `<script>`/`<style>` block ([#205](https://github.com/sveltejs/prettier-plugin-svelte/issues/205))

## 2.1.4

* Don't print an empty line at the end of code embedded inside Markdown (further fixes) ([#202](https://github.com/sveltejs/prettier-plugin-svelte/issues/202))

## 2.1.3

* Don't print an empty line at the end of code embedded inside Markdown ([#202](https://github.com/sveltejs/prettier-plugin-svelte/issues/202))

## 2.1.2

* Keep whitespace around `<script>`/`<style>` tags ([#197](https://github.com/sveltejs/prettier-plugin-svelte/issues/197))
* Make `<script>`/`<style>` tag snipping case-sensitive ([#198](https://github.com/sveltejs/prettier-plugin-svelte/issues/198))

## 2.1.1

* Fix `svelteBracketNewLine: true` sometimes not having `>` on a separate line ([#194](https://github.com/sveltejs/prettier-plugin-svelte/issues/194))

## 2.1.0

* Support Prettier's `htmlWhitespaceSensitivity` setting
* When `svelteBracketNewLine` is set to `true` and only the closing tag has whitespace before it, print the closing `>` on a separate line

## 2.0.3

* When `svelteBracketNewLine` is set to `false`, don't print the closing `>` in a separate line if possible ([#183](https://github.com/sveltejs/prettier-plugin-svelte/issues/183))

## 2.0.2

* Fix formatting of `<template>` tags with an unsupported language inside

## 2.0.1

* Fix formatting of inline element when there's a line at the start/end ([#183](https://github.com/sveltejs/prettier-plugin-svelte/issues/183))

## 2.0.0

This release comes with a rewrite of the HTML formatting. The output is now much more in line with how standard Prettier formats HTML. This is also why `svelteBracketNewLine` now defaults to `true`. Another notable default change is the sort order: `svelte:options` is now part of the sort order and the default changed to `options-scripts-markup-styles`, which is in line with how the majority of users like to order the code blocks.

The complete list of changes:

* Rework the tag breaking logic with the goal to be more in line with how Prettier formats standard HTML. This includes respecting the user's decision to have child tags in separate lines even if they don't exceed the maximum line width ([#143](https://github.com/sveltejs/prettier-plugin-svelte/issues/143), [#117](https://github.com/sveltejs/prettier-plugin-svelte/issues/117)). This is a breaking change because tags are broken up differently now than before.
* `<svelte:options>` is now part of `svelteSortOrder`. Default sort order is now `options-scripts-markup-styles`. This is a breaking change. ([#73](https://github.com/sveltejs/prettier-plugin-svelte/issues/73))
* `svelteBracketNewLine` defaults to `true` now to be more in line with how Prettier formats standard HTML. This is a breaking change
* Fix formatting of fenced Svelte code blocks inside Markdown ([#129](https://github.com/sveltejs/prettier-plugin-svelte/issues/129))
* Everything that is not explicitly a block element is now treated as an inline element, including components. This is a breaking change ([#159](https://github.com/sveltejs/prettier-plugin-svelte/issues/159))
* Single quotes are no longer forced except inside quoted attributes/events/etc. This is a breaking change ([#94](https://github.com/sveltejs/prettier-plugin-svelte/issues/94))
* If the content inside a `{tag}` is too long, break it up if possible (excluding `{#if}`/`{#await}`/etc. blocks). This is a breaking change ([#170](https://github.com/sveltejs/prettier-plugin-svelte/issues/170))
* If the content of a `<script>`/`<style>` tag is completely empty (no whitespace), don't put the closing tag on a new line ([#87](https://github.com/sveltejs/prettier-plugin-svelte/issues/87))

## 1.4.2

* Pass options to embedded parser ([#162](https://github.com/sveltejs/prettier-plugin-svelte/issues/162))
* Fall back to raw text if there is a parser error in a JS expression inside a moustache tag ([#163](https://github.com/sveltejs/prettier-plugin-svelte/issues/163))

## 1.4.1

* Format next node correctly when previous node has a comment as last child ([#152](https://github.com/sveltejs/prettier-plugin-svelte/issues/152))
* Only `prettier-ignore` comments should ignore formatting of next line ([#151](https://github.com/sveltejs/prettier-plugin-svelte/issues/151))
* Do not encode entities in attribute values ([#29](https://github.com/sveltejs/prettier-plugin-svelte/issues/29))
* Fix raw printing of unsupported languages ([#156](https://github.com/sveltejs/prettier-plugin-svelte/issues/156))

## 1.4.0

* Fix print order of attributes and body ([#146](https://github.com/sveltejs/prettier-plugin-svelte/issues/146))
* Support the new `{#key}` block introduced in Svelte 3.28.0 ([#147](https://github.com/sveltejs/prettier-plugin-svelte/pull/147))

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
