import { SupportLanguage, Parser, Printer } from 'prettier';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import { hasPragma, print } from './print';
import { ASTNode } from './print/nodes';
import { embed, getVisitorKeys } from './embed';
import { snipScriptAndStyleTagContent } from './lib/snipTagContent';
import { parse, VERSION } from 'svelte/compiler';
import { ParserOptions } from './options';

const babelParser = prettierPluginBabel.parsers.babel;
const typescriptParser = prettierPluginBabel.parsers['babel-ts']; // TODO use TypeScript parser in next major?
const isSvelte5Plus = Number(VERSION.split('.')[0]) >= 5;

function locStart(node: any) {
    return node.start;
}

function locEnd(node: any) {
    return node.end;
}

export const languages: Partial<SupportLanguage>[] = [
    {
        name: 'svelte',
        parsers: ['svelte'],
        extensions: ['.svelte'],
        vscodeLanguageIds: ['svelte'],
    },
];

export const parsers: Record<string, Parser> = {
    svelte: {
        hasPragma,
        parse: (text) => {
            try {
                return <ASTNode>{ ...parse(text), __isRoot: true };
            } catch (err: any) {
                if (err.start != null && err.end != null) {
                    // Prettier expects error objects to have loc.start and loc.end fields.
                    // Svelte uses start and end directly on the error.
                    err.loc = {
                        start: err.start,
                        end: err.end,
                    };
                }

                throw err;
            }
        },
        preprocess: (text, options: ParserOptions) => {
            const result = snipScriptAndStyleTagContent(text);
            text = result.text.trim();
            // Prettier sets the preprocessed text as the originalText in case
            // the Svelte formatter is called directly. In case it's called
            // as an embedded parser (for example when there's a Svelte code block
            // inside markdown), the originalText is not updated after preprocessing.
            // Therefore we do it ourselves here.
            options.originalText = text;
            // Only Svelte 5 can have TS in the template
            options._svelte_ts = isSvelte5Plus && result.isTypescript;
            options._svelte_is5Plus = isSvelte5Plus;
            return text;
        },
        locStart,
        locEnd,
        astFormat: 'svelte-ast',
    },
    svelteExpressionParser: {
        ...babelParser,
        parse: (text: string, options: any) => {
            const ast = babelParser.parse(text, options);

            let program = ast.program.body[0];
            if (!options._svelte_asFunction) {
                program = program.expression;
            }

            return { ...ast, program };
        },
    },
    svelteTSExpressionParser: {
        ...typescriptParser,
        parse: (text: string, options: any) => {
            const ast = typescriptParser.parse(text, options);

            let program = ast.program.body[0];
            if (!options._svelte_asFunction) {
                program = program.expression;
            }

            return { ...ast, program };
        },
    },
};

export const printers: Record<string, Printer> = {
    'svelte-ast': {
        print,
        embed,
        // @ts-expect-error Prettier's type definitions are wrong
        getVisitorKeys,
    },
};

export { options } from './options';
