# Prettier for Svelte components

Format your svelte components using prettier.

## Features

-   Format your html, css, and javascript using prettier
-   Format Svelte syntax, e.g. each loops, if statements, await blocks, etc.
-   Format the javascript expressions embedded in the svelte syntax
    -   e.g. expressions inside of `{}`, event bindings `on:click=""`, and more

## How to use

Install prettier-plugin-svelte as a dev dependency in your project.

Then format your code using prettier cli. You may need to add `--plugin-search-dir=.`

```
prettier --write --plugin-search-dir=. ./**/*.html
```
