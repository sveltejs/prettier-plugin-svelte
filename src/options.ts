import { ParserOptions as PrettierParserOptions, SupportOption } from 'prettier';

export interface ParserOptions<T = any> extends PrettierParserOptions<T>, Partial<PluginOptions> {}

export interface PluginOptions {
    svelteSortOrder: SortOrder;
    svelteStrictMode: boolean;
    svelteBracketNewLine: boolean;
    svelteAllowShorthand: boolean;
    svelteIndentScriptAndStyle: boolean;
}

function makeChoice(choice: string) {
    return { value: choice, description: choice };
}

export const options: Record<keyof PluginOptions, SupportOption> = {
    svelteSortOrder: {
        category: 'Svelte',
        type: 'choice',
        default: 'options-scripts-markup-styles',
        description: 'Sort order for scripts, markup, and styles',
        choices: [
            makeChoice('options-scripts-markup-styles'),
            makeChoice('options-scripts-styles-markup'),
            makeChoice('options-markup-styles-scripts'),
            makeChoice('options-markup-scripts-styles'),
            makeChoice('options-styles-markup-scripts'),
            makeChoice('options-styles-scripts-markup'),
            makeChoice('scripts-options-markup-styles'),
            makeChoice('scripts-options-styles-markup'),
            makeChoice('markup-options-styles-scripts'),
            makeChoice('markup-options-scripts-styles'),
            makeChoice('styles-options-markup-scripts'),
            makeChoice('styles-options-scripts-markup'),
            makeChoice('scripts-markup-options-styles'),
            makeChoice('scripts-styles-options-markup'),
            makeChoice('markup-styles-options-scripts'),
            makeChoice('markup-scripts-options-styles'),
            makeChoice('styles-markup-options-scripts'),
            makeChoice('styles-scripts-options-markup'),
            makeChoice('scripts-markup-styles-options'),
            makeChoice('scripts-styles-markup-options'),
            makeChoice('markup-styles-scripts-options'),
            makeChoice('markup-scripts-styles-options'),
            makeChoice('styles-markup-scripts-options'),
            makeChoice('styles-scripts-markup-options'),
            makeChoice('none'),
            // Deprecated, keep in 2.x for backwards-compatibility. svelte:options will be moved to the top
            makeChoice('scripts-markup-styles'),
            makeChoice('scripts-styles-markup'),
            makeChoice('markup-styles-scripts'),
            makeChoice('markup-scripts-styles'),
            makeChoice('styles-markup-scripts'),
            makeChoice('styles-scripts-markup'),
        ],
    },
    svelteStrictMode: {
        category: 'Svelte',
        type: 'boolean',
        default: false,
        description: 'More strict HTML syntax: Quotes in attributes',
    },
    svelteBracketNewLine: {
        category: 'Svelte',
        type: 'boolean',
        description: 'Put the `>` of a multiline element on a new line',
        deprecated: '2.5.0',
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
    | 'none'
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

export function parseSortOrder(
    sortOrder: SortOrder = 'options-scripts-markup-styles',
): SortOrderPart[] {
    if (sortOrder === 'none') {
        return [];
    }

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

export function isBracketSameLine(options: ParserOptions): boolean {
    return options.svelteBracketNewLine != null
        ? !options.svelteBracketNewLine
        : options.bracketSameLine != null
        ? options.bracketSameLine
        : false;
}
