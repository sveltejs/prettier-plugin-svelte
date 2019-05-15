import { SupportOption } from 'prettier';

declare module 'prettier' {
    interface RequiredOptions extends PluginOptions {}
}

export interface PluginOptions {
    sortOrder: SortOrder;
}

export const options: Record<keyof PluginOptions, SupportOption> = {
    sortOrder: {
        type: 'choice',
        default: 'scripts-css-html',
        description: 'Sort order for scripts, html, and css',
        choices: [
            { value: 'scripts-css-html' },
            { value: 'scripts-html-css' },
            { value: 'html-css-scripts' },
            { value: 'html-scripts-css' },
            { value: 'css-html-scripts' },
            { value: 'css-scripts-html' },
        ],
    },
};

export type SortOrder =
    | 'scripts-html-css'
    | 'scripts-css-html'
    | 'html-scripts-css'
    | 'html-css-scripts'
    | 'css-scripts-html'
    | 'css-html-scripts';

export type SortOrderPart = 'scripts' | 'html' | 'css';

const sortOrderSeparator = '-';

export function parseSortOrder(sortOrder: SortOrder): SortOrderPart[] {
    return sortOrder.split(sortOrderSeparator) as SortOrderPart[];
}
