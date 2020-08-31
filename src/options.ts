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
    svelteReportSyntaxErrors: boolean;
}

export const options: Record<keyof PluginOptions, SupportOption> = {
    svelteSortOrder: {
        type: 'choice',
        default: 'scripts-styles-markup',
        description: 'Sort order for scripts, styles, and markup',
        choices: [
            { value: 'scripts-styles-markup' },
            { value: 'scripts-markup-styles' },
            { value: 'markup-styles-scripts' },
            { value: 'markup-scripts-styles' },
            { value: 'styles-markup-scripts' },
            { value: 'styles-scripts-markup' },
        ],
    },
    svelteStrictMode: {
        type: 'boolean',
        default: false,
        description: 'More strict HTML syntax: self-closed tags, quotes in attributes',
    },
    svelteBracketNewLine: {
        type: 'boolean',
        default: false,
        description: 'Put the `>` of a multiline element on a new line',
    },
    svelteAllowShorthand: {
        type: 'boolean',
        default: true,
        description: 'Option to enable/disable component attribute shorthand if attribute name and expressions are same',
    },
    svelteIndentScriptAndStyle: {
        type: 'boolean',
        default: true,
        description: 'Whether or not to indent the code inside <script> and <style> tags in Svelte files',
    },
    svelteReportSyntaxErrors: {
        type: 'boolean',
        default: true,
        description: 'Whether to report any syntax errors in script tags in the console output',
    }
};

export type SortOrder =
    | 'scripts-styles-markup'
    | 'scripts-markup-styles'
    | 'markup-styles-scripts'
    | 'markup-scripts-styles'
    | 'styles-markup-scripts'
    | 'styles-scripts-markup';

export type SortOrderPart = 'scripts' | 'markup' | 'styles';

const sortOrderSeparator = '-';

export function parseSortOrder(sortOrder: SortOrder): SortOrderPart[] {
    return sortOrder.split(sortOrderSeparator) as SortOrderPart[];
}
