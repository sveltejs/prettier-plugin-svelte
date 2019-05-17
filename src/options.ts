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
