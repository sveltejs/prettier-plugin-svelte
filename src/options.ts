import { ParserOptions as PrettierParserOptions, SupportOption } from 'prettier';
import { SortOrder, PluginConfig } from '..';

export interface ParserOptions<T = any> extends PrettierParserOptions<T>, Partial<PluginConfig> {
    _svelte_ts?: boolean;
    _svelte_asFunction?: boolean;
    /**
     * Used for
     * - deciding what quote behavior to use in the printer:
     *   A future version of Svelte treats quoted expressions as strings, so never use quotes in that case.
     *   Since Svelte 5 does still treat them equally, it's safer to remove quotes in all cases and in a future
     *   version of this plugin instead leave it up to the user to decide.
     */
    _svelte_is5Plus?: boolean;
}

function makeChoice(choice: string) {
    return { value: choice, description: choice };
}

export const options: Record<keyof PluginConfig, SupportOption> = {
    svelte5CompilerPath: {
        category: 'Svelte',
        type: 'string',
        default: '',
        description: 'Only set this when using Svelte 5! Path to the Svelte 5 compiler',
    },
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
        ],
    },
    svelteStrictMode: {
        category: 'Svelte',
        type: 'boolean',
        default: false,
        description: 'More strict HTML syntax: Quotes in attributes, no self-closing DOM tags',
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
        throw new Error('svelteSortOrder is missing option `options`');
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
