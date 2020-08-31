# Prettier for Svelte 3 components

Format your svelte components using prettier.

## Features

-   Format your html, css, and javascript using prettier
-   Format Svelte syntax, e.g. each loops, if statements, await blocks, etc.
-   Format the javascript expressions embedded in the svelte syntax
    -   e.g. expressions inside of `{}`, event bindings `on:click=""`, and more

## How to use in VS Code and Atom
This plugin comes with [Svelte for VS Code](https://github.com/UnwrittenFun/svelte-vscode) and [Svelte for Atom](https://github.com/UnwrittenFun/svelte-atom) so just install extension for your favorite editor and enjoy.


## Configure for VS Code and Atom
``Configurations are optional``

Make `.prettierrc` file in your project directory (Read more about prettier config files [here](https://prettier.io/docs/en/configuration.html))
and add your preferred configuration options:


- **`svelteSortOrder`**
  - Default: `scripts-styles-markup`
  - Sort order for scripts, styles, and markup.

- **`svelteStrictMode`**
  - Default: `false`
  - More strict HTML syntax: self-closed tags, quotes in attributes, no attribute shorthand (overrules `svelteAllowShorthand`).

- **`svelteAllowShorthand`**
  - Default: `true`
  - Option to enable/disable component attribute shorthand if attribute name and expression are same.
  
- **`svelteBracketNewLine`**
  - Default: `false`
  - Put the `>` of a multiline element on a new line (svelte equivalent of [jsxBracketSameLine](https://prettier.io/docs/en/options.html#jsx-brackets) rule)

- **`svelteIndentScriptAndStyle`**
  - Default: `true`
  - Whether or not to indent the code inside `<script>` and `<style>` tags in Svelte files. This saves an indentation level, but might break code folding in your editor.

  For example:

  ```html
  <script>
    export let value;
  </script>

  <!-- allowShorthand: true -->
  <input type="text" {value}>

  <!-- allowShorthand: false -->
  <input type="text" value={value}>

  ```

### `.prettierrc` example

```json
{
  "svelteSortOrder" : "styles-scripts-markup",
  "svelteStrictMode": true,
  "svelteBracketNewLine": true,
  "svelteAllowShorthand": false,
  "svelteIndentScriptAndStyle": false
}
```


## How to install manually

```bash
npm i --save-dev prettier-plugin-svelte prettier
```

## How to use (CLI)

Install prettier-plugin-svelte as a dev dependency in your project.

Then format your code using prettier cli. You may need to add `--plugin-search-dir=.`

```
prettier --write --plugin-search-dir=. ./**/*.html
```

## Options (CLI)

**`svelte-sort-order`** Sort order for scripts, styles, and markup. Defaults to `scripts-styles-markup`.

```
prettier --write --svelte-sort-order scripts-markup-styles ./**/*.svelte
```

**`svelte-strict-mode`** Enable more strict syntax for HTML. Defaults to `false`.

Main difference in strict mode:

-   [Not all tags are self closing](http://xahlee.info/js/html5_non-closing_tag.html)
-   Expressions in attributes are wrapped by double quotes
