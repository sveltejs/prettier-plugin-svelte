# Prettier for Svelte 3 components

Format your svelte components using prettier.

## Features

-   Format your html, css, and javascript using prettier
-   Format Svelte syntax, e.g. each loops, if statements, await blocks, etc.
-   Format the javascript expressions embedded in the svelte syntax
    -   e.g. expressions inside of `{}`, event bindings `on:click=""`, and more
    
## How to install

```bash
npm i --save-dev prettier-plugin-svelte prettier
```

## How to use

Install prettier-plugin-svelte as a dev dependency in your project.

Then format your code using prettier cli. You may need to add `--plugin-search-dir=.`

```
prettier --write --plugin-search-dir=. ./**/*.html
```

## Options

**`sort-order`** Sort order for scripts, styles, and markup. Defaults to `scripts-styles-markup`.

```
prettier --write --sort-order scripts-markup-styles ./**/*.svelte
```
