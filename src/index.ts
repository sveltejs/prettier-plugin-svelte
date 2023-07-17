import { SupportLanguage, Parser, Printer } from 'prettier';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import { hasPragma, print } from './print';
import { ASTNode } from './print/nodes';
import { embed } from './embed';
import { snipScriptAndStyleTagContent } from './lib/snipTagContent';

const babelParser = prettierPluginBabel.parsers.babel;

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
                return <ASTNode>{ ...require(`svelte/compiler`).parse(text), __isRoot: true };
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
        preprocess: (text, options) => {
            text = snipScriptAndStyleTagContent(text);
            text = text.trim();
            // Prettier sets the preprocessed text as the originalText in case
            // the Svelte formatter is called directly. In case it's called
            // as an embedded parser (for example when there's a Svelte code block
            // inside markdown), the originalText is not updated after preprocessing.
            // Therefore we do it ourselves here.
            options.originalText = text;
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
        
            return { ...ast, program: ast.program.body[0].expression };
        }
    }
};

export const printers: Record<string, Printer> = {
    'svelte-ast': {
        print,
        embed,
    },
};

export { options } from './options';
