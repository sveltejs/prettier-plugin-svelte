> This documentation is for `prettier-plugin-svelte` version 4 which only works with Svelte 5. See [this branch](https://github.com/sveltejs/prettier-plugin-svelte/tree/version-3) for documentation of previous versions.

# Prettier for Svelte components

Format your Svelte components using Prettier.

## Features

-   Format your HTML, CSS, and JavaScript using prettier
-   Format Svelte syntax, e.g. each loops, if statements, await blocks, etc.
-   Format the JavaScript expressions embedded in the Svelte syntax
    -   e.g. expressions inside of `{}`, event bindings `on:click=""`, and more

## VS Code Extension

This plugin is bundled in the [Svelte for VS Code](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) extension. If you only format through the editor, you therefore don't need to do anything in addition.

The extension lets you define options through extension-specific configuration. These settings are ignored however if there's any configuration file (`.prettierrc` for example) present.

## Prettier Plugin

Installing the plugin as a package allows:

-   customizing the formatting behavior
-   using the command line to format
-   using a different IDE
-   using the official VS Code [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extension to format Svelte files

### Compatibility

-   `prettier-plugin-svelte@4` only works with `prettier@3`
-   `prettier-plugin-svelte@3` only works with `prettier@3`
-   `prettier-plugin-svelte@2` only works with `prettier@2`

### Setup

Install Prettier and the plugin as a dev dependency:

```bash
npm i --save-dev prettier-plugin-svelte prettier
```

Then create a `.prettierrc` [configuration file](https://prettier.io/docs/en/configuration.html):

```jsonc
// .prettierrc
{
    // ..
    "plugins": ["prettier-plugin-svelte"],
    "pluginSearchDirs": ["."], // should be removed in v3
    "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }]
}
```

If you want to customize some formatting behavior, see section [Options](#options).

### CLI Usage

Format your code using the Prettier CLI.

```bash
npx prettier --write .
```

As part of your scripts in `package.json`:

```jsonc
// package.json
{
    // ..
    "scripts": {
        "format": "prettier --write ."
    }
}
```

If you want to customize some formatting behavior, see section [Options](#options).

## Options

`Configurations are optional`

Make a `.prettierrc` file in your project directory and add your preferred [options](https://prettier.io/docs/en/options.html) to [configure Prettier](https://prettier.io/docs/en/configuration.html). When using Prettier through the CLI, you can also pass options through CLI flags, but a `.prettierrc` file is recommended.

### Svelte Sort Order

Sort order for `svelte:options`, scripts, markup, and styles.

Format: join the keywords `options`, `scripts`, `markup`, `styles` with a `-` in the order you want; or `none` if you don't want Prettier to reorder anything.

| Default                         | CLI Override                   | API Override                |
| ------------------------------- | ------------------------------ | --------------------------- |
| `options-scripts-markup-styles` | `--svelte-sort-order <string>` | `svelteSortOrder: <string>` |

> The `options` order option only exists since version 2. If you use version 1 of `prettier-plugin-svelte`, omit that option (so for example only write `scripts-markup-styles`).

### Svelte Allow Shorthand

Option to enable/disable component attribute shorthand if attribute name and expression are same.

Example:

<!-- prettier-ignore -->
```html
<!-- allowShorthand: true -->
<input type="text" {value} />

<!-- allowShorthand: false -->
<input type="text" value={value} />
```

| Default | CLI Override                      | API Override                   |
| ------- | --------------------------------- | ------------------------------ |
| `false`  | `--svelte-allow-shorthand <bool>` | `svelteAllowShorthand: <bool>` |

### Svelte Bracket New Line

> Deprecated since 2.5.0. Use Prettier 2.4.0 and [bracketSameLine](https://prettier.io/docs/en/options.html#bracket-line) instead.

Put the `>` of a multiline element on a new line. Roughly the Svelte equivalent of the [jsxBracketSameLine](https://prettier.io/docs/en/options.html#jsx-brackets) rule. Setting this to `false` will have no effect for whitespace-sensitive tags (inline elements) when there's no whitespace between the `>` of the start tag and the inner content, or when there's no whitespace after the `>` of the end tag. You can read more about HTML whitespace sensitivity [here](https://prettier.io/blog/2018/11/07/1.15.0.html#whitespace-sensitive-formatting). You can adjust whitespace sensitivity through [this setting](https://prettier.io/docs/en/options.html#html-whitespace-sensitivity).

Example:

<!-- prettier-ignore -->
```html
<!-- before formatting -->
<span><div>foo</div><span>bar</span></span>
<div pretend break>content</div>

<!-- after formatting, svelteBracketNewLine true -->
<span
    ><div>foo</div>
    <span>bar</span></span
>
<div
     pretend
     break
>
    content
</div>

<!-- after formatting, svelteBracketNewLine false -->
<span
    ><div>foo</div>
    <span>bar</span></span>
<div
     pretend
     break>
    content
</div>
```

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
    "svelteSortOrder": "options-styles-scripts-markup",
    "svelteBracketNewLine": false,
    "svelteAllowShorthand": false,
    "svelteIndentScriptAndStyle": false
}
```

## Usage with Tailwind Prettier Plugin

-   VS Code Extension: Use it as the default formatter for Svelte files
-   Prettier Plugin: Load the Tailwind plugin in the end - [Tailwind docs](https://github.com/tailwindlabs/prettier-plugin-tailwindcss#compatibility-with-other-prettier-plugins)

```jsonc
// .prettierrc
{
    // ..
    "plugins": [
        "prettier-plugin-svelte",
        "prettier-plugin-tailwindcss" // MUST come last
    ]
}
```

Since we are using configuration overrides to handle svelte files, you might also have to configure the [prettier.documentselectors](https://github.com/prettier/prettier-vscode#prettierdocumentselectors) in your VS Code `settings.json`, to tell Prettier extension to handle svelte files, like this:

```jsonc
// settings.json
{
    // ..
    "prettier.documentSelectors": ["**/*.svelte"]
}
```

## Usage in the browser

Usage in the browser is semi-supported. You can import the plugin from `prettier-plugin-svelte/browser` to get a version that depends on `prettier/standalone` and therefore doesn't use any node APIs. What isn't supported in a good way yet is using this without a build step - you still need a bundler like Vite to build everything together as one self-contained package in advance.

## Migration

> For migration to `prettier-plugin-svelte@3` [see here](https://github.com/sveltejs/prettier-plugin-svelte/tree/version-3?tab=readme-ov-file#migration).

Upgrade to Svelte 5 before upgrading to `prettier-plugin-svelte@4`, as it doesn't support older Svelte versions.

`svelteStrictMode` option has been removed. Attributes are now never quoted, because this will mean "stringify this attribute value" in a future Svelte version.

## FAQ

### Why is the closing or opening tag (`>` or `<`) hugging the inner tag or text?

If you are wondering why this code

<!-- prettier-ignore -->
```html
<span><span>assume very long text</span></span>
```

becomes this

<!-- prettier-ignore -->
```html
<span
      ><span>assume very long text</span
    ></span
>
```

it's because of whitespace sensitivity. For inline elements (`span`, `a`, etc) it makes a difference when rendered if there's a space (or newline) between them. Since we don't know if your slot inside your Svelte component is surrounded by inline elements, Svelte components are treated as such, too. You can adjust this whitespace sensitivity through [this setting](https://prettier.io/docs/en/options.html#html-whitespace-sensitivity). You can read more about HTML whitespace sensitivity [here](https://prettier.io/blog/2018/11/07/1.15.0.html#whitespace-sensitive-formatting).
