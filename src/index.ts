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
        parse: async (text, options: ParserOptions) => {
            try {
                let _parse = parse;
                if (options.svelte5CompilerPath) {
                    try {
                        _parse = (await import(options.svelte5CompilerPath)).parse;
                    } catch (e) {
                        console.warn(
                            `Failed to load Svelte 5 compiler from ${options.svelte5CompilerPath}`,
                        );
                        console.warn(e);
                        options.svelte5CompilerPath = undefined;
                    }
                }

                // Prettier does a sanity check on ast.comments after printing
                // to verify all comments were printed. Since the comments array
                // includes script/style comments already handled by embedded
                // parsers, we stash the full array on _comments and remove
                // comments so Prettier doesn't try to process them itself.
                // We then manually attach attribute comments in embed().
                const root = _parse(text) as Record<string, any>;
                (root as ASTNode)._comments = root.comments;
                delete root.comments;
                (root as ASTNode).__isRoot = true;

                return root;
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
            const is = !!options.svelte5CompilerPath || isSvelte5Plus;
            options._svelte_ts = is && result.isTypescript;
            options._svelte_is5Plus = is;
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
        // @ts-expect-error Prettier's type definitions don't include getVisitorKeys
        getVisitorKeys,
        isBlockComment(comment: any) {
            return comment.type === 'Block';
        },
        printComment(commentPath: any) {
            const comment = commentPath.getValue();
            if (comment.type === 'Line') {
                return '//' + comment.value.replace(/\r$/, '');
            }
            return '/*' + comment.value + '*/';
        },
    },
};

export { options } from './options';
