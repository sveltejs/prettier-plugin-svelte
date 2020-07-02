import { SupportOption } from 'prettier';

declare module 'prettier' {
    interface RequiredOptions extends PluginOptions {}
}

export interface PluginOptions {
    svelteSortOrder: SortOrder;
    svelteStrictMode: boolean;
    svelteBracketNewLine: boolean;
    svelteAllowShorthand: boolean;
}

export const options: Record<keyof PluginOptions, SupportOption> = {
    svelteSortOrder: {
        type: 'choice',
        default: 'scripts-markup-styles',
        description: 'Sort order for scripts, styles, and markup',
        choices: [
            { value: 'scripts-markup-styles' },
            { value: 'scripts-styles-markup' },
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
};

export type SortOrder =
    | 'scripts-markup-styles'
    | 'scripts-styles-markup'
    | 'markup-styles-scripts'
    | 'markup-scripts-styles'
    | 'styles-markup-scripts'
    | 'styles-scripts-markup';

export type SortOrderPart = 'scripts' | 'markup' | 'styles';

const sortOrderSeparator = '-';

export function parseSortOrder(sortOrder: SortOrder): SortOrderPart[] {
    return sortOrder.split(sortOrderSeparator) as SortOrderPart[];
}
