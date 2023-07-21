# Prettier for Svelte components

Format your Svelte components using Prettier.

## Features

-   Format your HTML, CSS, and JavaScript using prettier
-   Format Svelte syntax, e.g. each loops, if statements, await blocks, etc.
-   Format the JavaScript expressions embedded in the Svelte syntax
    -   e.g. expressions inside of `{}`, event bindings `on:click=""`, and more

## How to use in your IDE

This plugin comes bundled with the [Svelte for VS Code](https://github.com/sveltejs/language-tools). If you only format through the editor, you therefore don't need to do anything in addition.

If you want to

-   customize some formatting behavior
-   use the official VS Code Prettier extension to format Svelte files instead
-   use a different editor
-   also want to use the command line to format

then you need to install the plugin and setup a Prettier configuration file as described in the next section.

Some of the extensions let you define options through extension-specific configuration. These settings are ignored however if there's any configuration file (`.prettierrc` for example) present.

## How to install manually

First install Prettier and the plugin as a dev depenendency:

```bash
npm i --save-dev prettier-plugin-svelte prettier
```

Then create a `.prettierrc` file to tell Prettier about the plugin:

```json
{
    "plugins": ["prettier-plugin-svelte"]
}
```

If you're using `prettier-plugin-svelte` version 2 with `pnpm` and have problems getting it to work, you may need to use a `.prettierrc.cjs` file instead to point Prettier to the exact location of the plugin using `require.resolve`:

```js
module.exports = {
    pluginSearchDirs: false, // you can omit this when using Prettier version 3
    plugins: [require('prettier-plugin-svelte')],
    overrides: [{ files: '*.svelte', options: { parser: 'svelte' } }],

    // Other prettier options here
};
```

> Do NOT use the above with version 3 of the plugin

If you want to customize some formatting behavior, see section "Options" below.

## How to use (CLI)

Format your code using Prettier CLI.

As a one-time run:

```
npx prettier --write --plugin prettier-plugin-svelte .
```

As part of your scripts in `package.json`:

```
"format": "prettier --write  --plugin prettier-plugin-svelte ."
```

> There's currently [an issue with Prettier 3](https://github.com/prettier/prettier/issues/15079) which requires the seemingly redundant `--plugin` setting

If you want to customize some formatting behavior, see section "Options" below.

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

### Svelte Strict Mode

More strict HTML syntax: Quotes in attributes and no self-closing DOM elements (except void elements).

> In version 2 this overruled `svelteAllowShorthand`, which is no longer the case.

Example:

<!-- prettier-ignore -->
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

<!-- prettier-ignore -->
```html
<!-- allowShorthand: true -->
<input type="text" {value} />

<!-- allowShorthand: false -->
<input type="text" value={value} />
```

| Default | CLI Override                      | API Override                   |
| ------- | --------------------------------- | ------------------------------ |
| `true`  | `--svelte-allow-shorthand <bool>` | `svelteAllowShorthand: <bool>` |

### Svelte Self Closing Elements

Whether or not empty elements (such as `div`s) should be self-closed or not.

Example:

<!-- prettier-ignore -->
```html
<!-- svelteSelfCloseElements: "always" -->
<div />

<!-- svelteSelfCloseElements: "never" -->
<div></div>
```

| Default   | CLI Override                         | API Override                       |          |
| --------- | ------------------------------------ | ---------------------------------- | -------- |
| `"never"` | `--svelte-self-close-elements <str>` | `svelteSelfCloseElements: "always" | "never"` |

### Svelte Self Closing Components

Whether or not empty components should be self-closed or not.

Example:

<!-- prettier-ignore -->
```html
<!-- svelteSelfCloseComponents: "always" -->
<Component />

<!-- svelteSelfCloseComponents: "never" -->
<Component></Component>
```

| Default    | CLI Override                           | API Override                         |          |
| ---------- | -------------------------------------- | ------------------------------------ | -------- |
| `"always"` | `--svelte-self-close-components <str>` | `svelteSelfCloseComponents: "always" | "never"` |

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
    "svelteStrictMode": true,
    "svelteBracketNewLine": false,
    "svelteAllowShorthand": false,
    "svelteIndentScriptAndStyle": false
}
```

## Usage with Tailwind Prettier Plugin

There is a [Tailwind Prettier Plugin](https://github.com/tailwindlabs/prettier-plugin-tailwindcss) to format classes in a certain way. This plugin must be loaded last, so if you want to use the Tailwind plugin, disable Prettier auto-loading and place `prettier-plugin-tailwindcss` in the end of the plugins array. If you are using VS Code, make sure to have the Prettier extension installed and switch the default formatter for Svelte files to it.

```json5
// .prettierrc
{
    // ..
    plugins: [
        'prettier-plugin-svelte',
        'prettier-plugin-tailwindcss', // MUST come last
    ],
    pluginSearchDirs: false, // you can omit this when using Prettier version 3
}
```

More info: https://github.com/tailwindlabs/prettier-plugin-tailwindcss#compatibility-with-other-prettier-plugins

Since we are using configuration overrides to handle svelte files, you might also have to configure the [prettier.documentselectors](https://github.com/prettier/prettier-vscode#prettierdocumentselectors) in your VS Code `settings.json`, to tell Prettier extension to handle svelte files, like this:

```json5
// settings.json
{
    // ..
    'prettier.documentSelectors': ['**/*.svelte'],
}
```

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

it's because of whitespsace sensitivity. For inline elements (`span`, `a`, etc) it makes a difference when rendered if there's a space (or newline) between them. Since we don't know if your slot inside your Svelte component is surrounded by inline elements, Svelte components are treated as such, too. You can adjust this whitespace sensitivity through [this setting](https://prettier.io/docs/en/options.html#html-whitespace-sensitivity). You can read more about HTML whitespace sensitivity [here](https://prettier.io/blog/2018/11/07/1.15.0.html#whitespace-sensitive-formatting).

### Which versions are compatibly with which Prettier version?

`prettier-plugin-svelte` v2 is compatible with Prettier v2 and incompatible with Prettier v3.
`prettier-plugin-svelte` v3 is compatible with Prettier v3 and incompatible with lower Prettier versions.

### How to migrate from version 2 to 3?

Version 3 contains the following breaking changes:

-   Whether or not empty elements/components should self-close is now left to the user - in other words, if you write `<div />` or `<Component />` that stays as is, and so does `<div></div>`/`<Component></Component>`. If `svelteStrictMode` is turned on, it will still only allow `<div></div>` notation for elements (but it will leave your components alone)
-   `svelteAllowShorthand` now takes precedence over `svelteStrictMode`, which no longer has any effect on that behavior. Set `svelteAllowShorthand` to `false` to get back the v2 behavior
-   Some deprecated `svelteSortOrder` options were removed, see the the options section above for which values are valid for that options

Version 3 of this plugin requires Prettier version 3, it won't work with lower versions. Prettier version 3 contains some changes to how it loads plugins which may require you to adjust your configuration file:

-   Prettier no longer searches for plugins in the directory automatically, you need to tell Prettier specifically which plugins to use. This means you need to add `"plugins": ["prettier-plugin-svelte"]` to your config if you haven't already. Also remove the deprecated option `pluginSearchDirs`. When invoking Prettier from the command line, you currently need to pass `--plugin prettier-plugin-svelte` in order to format Svelte files [due to a bug in Prettier](https://github.com/prettier/prettier/issues/15079)
-   Prettier loads plugins from the plugin array differently. If you have used `require.resolve("prettier-plugin-svelte")` in your `.prettierrc.cjs` to tell Prettier where to find the plugin, you may need to remove that and just write `"prettier-plugin-svelte"` instead
