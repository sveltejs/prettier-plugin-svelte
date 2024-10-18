import { Config, SupportOption, SupportLanguage, Parser, Printer } from 'prettier';

export interface PluginConfig {
    svelteSortOrder?: SortOrder;
    svelteBracketNewLine?: boolean;
    svelteAllowShorthand?: boolean;
    svelteIndentScriptAndStyle?: boolean;
}

export type PrettierConfig = PluginConfig & Config;

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
    | 'none';

export declare const options: Record<keyof PluginConfig, SupportOption>;
export declare const languages: Partial<SupportLanguage>[];
export declare const parsers: {
    svelte: Parser;
    svelteExpressionParser: Parser;
    svelteTSExpressionParser: Parser;
};
export declare const printers: {
    'svelte-ast': Printer;
};
