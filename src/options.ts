import { SupportOption } from 'prettier';

declare module 'prettier' {
    interface RequiredOptions extends PluginOptions {}
}

export interface PluginOptions {
    svelteSortOrder: SortOrder;
    svelteStrictMode: boolean;
    svelteBracketNewLine: boolean;
    svelteAllowShorthand: boolean;
    svelteIndentScriptAndStyle: boolean;
}

export const options: Record<keyof PluginOptions, SupportOption> = {
    svelteSortOrder: {
        category: 'Svelte',
        type: 'choice',
        default: 'options-scripts-markup-styles',
        description: 'Sort order for scripts, markup, and styles',
        choices: [
            { value: 'options-scripts-markup-styles' },
            { value: 'options-scripts-styles-markup' },
            { value: 'options-markup-styles-scripts' },
            { value: 'options-markup-scripts-styles' },
            { value: 'options-styles-markup-scripts' },
            { value: 'options-styles-scripts-markup' },
            { value: 'scripts-options-markup-styles' },
            { value: 'scripts-options-styles-markup' },
            { value: 'markup-options-styles-scripts' },
            { value: 'markup-options-scripts-styles' },
            { value: 'styles-options-markup-scripts' },
            { value: 'styles-options-scripts-markup' },
            { value: 'scripts-markup-options-styles' },
            { value: 'scripts-styles-options-markup' },
            { value: 'markup-styles-options-scripts' },
            { value: 'markup-scripts-options-styles' },
            { value: 'styles-markup-options-scripts' },
            { value: 'styles-scripts-options-markup' },
            { value: 'scripts-markup-styles-options' },
            { value: 'scripts-styles-markup-options' },
            { value: 'markup-styles-scripts-options' },
            { value: 'markup-scripts-styles-options' },
            { value: 'styles-markup-scripts-options' },
            { value: 'styles-scripts-markup-options' },
            // Deprecated, keep in 2.x for backwards-compatibility. svelte:options will be moved to the top
            { value: 'scripts-markup-styles' },
            { value: 'scripts-styles-markup' },
            { value: 'markup-styles-scripts' },
            { value: 'markup-scripts-styles' },
            { value: 'styles-markup-scripts' },
            { value: 'styles-scripts-markup' },
        ],
    },
    svelteStrictMode: {
        category: 'Svelte',
        type: 'boolean',
        default: false,
        description: 'More strict HTML syntax: self-closed tags, quotes in attributes',
    },
    svelteBracketNewLine: {
        category: 'Svelte',
        type: 'boolean',
        default: false,
        description: 'Put the `>` of a multiline element on a new line',
    },
    svelteAllowShorthand: {
        category: 'Svelte',
        type: 'boolean',
        default: true,
        description:
            'Option to enable/disable component attribute shorthand if attribute name and expressions are same',
    },
    svelteIndentScriptAndStyle: {
        category: 'Svelte',
        type: 'boolean',
        default: true,
        description:
            'Whether or not to indent the code inside <script> and <style> tags in Svelte files',
    },
};

export type SortOrder =
    | 'options-scripts-markup-styles'
    | 'options-scripts-styles-markup'
    | 'options-markup-styles-scripts'
    | 'options-markup-scripts-styles'
    | 'options-styles-markup-scripts'
    | 'options-styles-scripts-markup'
    | 'scripts-options-markup-styles'
    | 'scripts-options-styles-markup'
    | 'markup-options-styles-scripts'
    | 'markup-options-scripts-styles'
    | 'styles-options-markup-scripts'
    | 'styles-options-scripts-markup'
    | 'scripts-markup-options-styles'
    | 'scripts-styles-options-markup'
    | 'markup-styles-options-scripts'
    | 'markup-scripts-options-styles'
    | 'styles-markup-options-scripts'
    | 'styles-scripts-options-markup'
    | 'scripts-markup-styles-options'
    | 'scripts-styles-markup-options'
    | 'markup-styles-scripts-options'
    | 'markup-scripts-styles-options'
    | 'styles-markup-scripts-options'
    | 'styles-scripts-markup-options'
    | DeprecatedSortOrder;

export type DeprecatedSortOrder =
    | 'scripts-markup-styles'
    | 'scripts-styles-markup'
    | 'markup-styles-scripts'
    | 'markup-scripts-styles'
    | 'styles-markup-scripts'
    | 'styles-scripts-markup';

export type SortOrderPart = 'scripts' | 'markup' | 'styles' | 'options';

const sortOrderSeparator = '-';

export function parseSortOrder(sortOrder: SortOrder): SortOrderPart[] {
    const order = sortOrder.split(sortOrderSeparator) as SortOrderPart[];
    // For backwards compatibility: Add options to beginning if not present
    if (!order.includes('options')) {
        console.warn(
            'svelteSortOrder is missing option `options`. This will be an error in prettier-plugin-svelte version 3.',
        );
        order.unshift('options');
    }
    return order;
}
