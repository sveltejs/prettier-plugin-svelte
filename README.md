# Prettier for Svelte 3 components

Format your Svelte components using Prettier.

## Features

-   Format your HTML, CSS, and JavaScript using prettier
-   Format Svelte syntax, e.g. each loops, if statements, await blocks, etc.
-   Format the JavaScript expressions embedded in the Svelte syntax
    -   e.g. expressions inside of `{}`, event bindings `on:click=""`, and more

## How to use in VS Code and Atom

This plugin comes with [Svelte for VS Code](https://github.com/sveltejs/language-tools) and [Svelte for Atom](https://github.com/UnwrittenFun/svelte-atom) so just install the extension for your favorite editor and enjoy.

If you want to customize some formatting behavior, see section "Options" below.

## How to install manually

```bash
npm i --save-dev prettier-plugin-svelte prettier
```

## How to use (CLI)

Install `prettier` and `prettier-plugin-svelte` as dev dependencies in your project.

Then format your code using Prettier CLI. You may need to add `--plugin-search-dir=.`

```
prettier --write --plugin-search-dir=. ./**/*.html
```

If you want to customize some formatting behavior, see section "Options" below.

## Options

``Configurations are optional``

Make a `.prettierrc` file in your project directory (Read more about prettier config files [here](https://prettier.io/docs/en/configuration.html))
and add your preferred configuration options. When using Prettier through the CLI, you can also pass options through CLI flags, but a `.prettierrc` file is recommended.

### Svelte Sort Order

Sort order for `svelte:options`, scripts, markup, and styles.

Format: join the keywords `options`, `scripts`, `markup`, `styles` with a `-` in the order you want.

| Default                         | CLI Override                   | API Override                |
| ------------------------------- | ------------------------------ | --------------------------- |
| `options-scripts-markup-styles` | `--svelte-sort-order <string>` | `svelteSortOrder: <string>` |

### Svelte Strict Mode

More strict HTML syntax: less self-closed tags, quotes in attributes, no attribute shorthand (overrules `svelteAllowShorthand`).

Example:

```html
<!-- svelteStrictMode: true -->
<div foo="{bar}"></div>

<!-- svelteStrictMode: false -->
<div foo={bar} />
```

| Default | CLI Override                  | API Override               |
| ------- | ----------------------------- | -------------------------- |
| `false` | `--svelte-strict-mode <bool>` | `svelteStrictMode: <bool>` |

### Svelte Allow Shorthand

Option to enable/disable component attribute shorthand if attribute name and expression are same.

Example:

```html
<!-- allowShorthand: true -->
<input type="text" {value} />

<!-- allowShorthand: false -->
<input type="text" value={value} />
```

| Default | CLI Override                      | API Override                   |
| ------- | --------------------------------- | ------------------------------ |
| `true`  | `--svelte-allow-shorthand <bool>` | `svelteAllowShorthand: <bool>` |

### Svelte Bracket New Line

Put the `>` of a multiline element on a new line, if possible. Roughly the Svelte equivalent of the [jsxBracketSameLine](https://prettier.io/docs/en/options.html#jsx-brackets) rule.

| Default | CLI Override                       | API Override                   |
| ------- | ---------------------------------- | ------------------------------ |
| `true`  | `--svelte-bracket-new-line <bool>` | `svelteBracketNewLine: <bool>` |

### Svelte Indent Script And Style

Whether or not to indent the code inside `<script>` and `<style>` tags in Svelte files. This saves an indentation level, but might break code folding in your editor.

| Default | CLI Override                              | API Override                         |
| ------- | ----------------------------------------- | ------------------------------------ |
| `true`  | `--svelte-indent-script-and-style <bool>` | `svelteIndentScriptAndStyle: <bool>` |

### `.prettierrc` example

```json
{
  "svelteSortOrder" : "options-styles-scripts-markup",
  "svelteStrictMode": true,
  "svelteBracketNewLine": false,
  "svelteAllowShorthand": false,
  "svelteIndentScriptAndStyle": false
}
```
