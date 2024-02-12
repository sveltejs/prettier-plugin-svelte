import { Doc, doc, FastPath, Options } from 'prettier';
import { getText } from './lib/getText';
import { snippedTagContentAttribute } from './lib/snipTagContent';
import { isBracketSameLine, ParserOptions } from './options';
import { PrintFn } from './print';
import { isLine, removeParentheses, trimRight } from './print/doc-helpers';
import { isASTNode, printWithPrependedAttributeLine } from './print/helpers';
import {
    assignCommentsToNodes,
    getAttributeTextValue,
    getLeadingComment,
    isIgnoreDirective,
    isInsideQuotedAttribute,
    isJSON,
    isLess,
    isNodeSupportedLanguage,
    isPugTemplate,
    isScss,
    isTypeScript,
    printRaw,
} from './print/node-helpers';
import { CommentNode, ElementNode, Node, ScriptNode, StyleNode } from './print/nodes';
import { extractAttributes } from './lib/extractAttributes';
import { base64ToString } from './base64-string';

const {
    builders: { group, hardline, softline, indent, dedent, literalline },
    utils: { removeLines },
} = doc;

const leaveAlone = new Set([
    'Script',
    'Style',
    'Identifier',
    'MemberExpression',
    'CallExpression',
    'ArrowFunctionExpression',
]);
const dontTraverse = new Set(['start', 'end', 'type']);

export function getVisitorKeys(node: any, nonTraversableKeys: Set<string>): string[] {
    return Object.keys(node).filter((key) => {
        return !nonTraversableKeys.has(key) && !leaveAlone.has(node.type) && !dontTraverse.has(key);
    });
}

// Embed works like this in Prettier v3:
// - do depth first traversal of all node properties
// - deepest property is calling embed first
// - if embed returns a function, it will be called after the traversal in a second pass, in the same order (deepest first)
// For performance reasons we try to only return functions when we're sure we need to transform something.
export function embed(path: FastPath, _options: Options) {
    const node: Node = path.getNode();
    const options = _options as ParserOptions;
    if (!options.locStart || !options.locEnd || !options.originalText) {
        throw new Error('Missing required options');
    }

    if (isASTNode(node)) {
        assignCommentsToNodes(node);
        if (node.module) {
            node.module.type = 'Script';
            node.module.attributes = extractAttributes(getText(node.module, options));
        }
        if (node.instance) {
            node.instance.type = 'Script';
            node.instance.attributes = extractAttributes(getText(node.instance, options));
        }
        if (node.css) {
            node.css.type = 'Style';
            node.css.content.type = 'StyleProgram';
        }
        return null;
    }

    // embed does depth first traversal with deepest node called first, therefore we need to
    // check the parent to see if we are inside an expression that should be embedded.
    const parent = path.getParentNode();
    const printJsExpression = () =>
        (parent as any).expression
            ? printJS(parent, options.svelteStrictMode ?? false, false, false, 'expression')
            : undefined;
    const printSvelteBlockJS = (name: string) => printJS(parent, false, true, false, name);

    switch (parent.type) {
        case 'IfBlock':
        case 'ElseBlock':
        case 'AwaitBlock':
        case 'KeyBlock':
            printSvelteBlockJS('expression');
            break;
        case 'EachBlock':
            printSvelteBlockJS('expression');
            printSvelteBlockJS('key');
            break;
        case 'SnippetBlock':
            // We merge the two parts into one expression, which future-proofs this for template TS support
            if (node === parent.expression) {
                parent.expression.end =
                    options.originalText.indexOf(
                        '}',
                        parent.context?.end ?? parent.expression.end,
                    );
                parent.context = null;
                printSvelteBlockJS('expression');
            }
            break;
        case 'Element':
            printJS(parent, options.svelteStrictMode ?? false, false, false, 'tag');
            break;
        case 'MustacheTag':
            printJS(parent, isInsideQuotedAttribute(path, options), false, false, 'expression');
            break;
        case 'RawMustacheTag':
            printJS(parent, false, false, false, 'expression');
            break;
        case 'Spread':
            printJS(parent, false, false, false, 'expression');
            break;
        case 'ConstTag':
            printJS(parent, false, false, true, 'expression');
            break;
        case 'RenderTag':
            // We merge the two parts into one expression, which future-proofs this for template TS support
            if (node === parent.expression) {
                parent.expression.end =
                    options.originalText.indexOf(
                        ')',
                        parent.argument?.end ?? parent.expression.end,
                    ) + 1;
                parent.argument = null;
                printJS(parent, false, false, false, 'expression');
            }
            break;
        case 'EventHandler':
        case 'Binding':
        case 'Class':
        case 'Let':
        case 'Transition':
        case 'Action':
        case 'Animation':
        case 'InlineComponent':
            printJsExpression();
            break;
    }

    if (node.isJS) {
        return async (
            textToDoc: (text: string, options: Options) => Promise<Doc>,
        ): Promise<Doc> => {
            try {
                const embeddedOptions = {
                    // Prettier only allows string references as parsers from v3 onwards,
                    // so we need to have another public parser and defer to that
                    parser: 'svelteExpressionParser',
                    singleQuote: node.forceSingleQuote ? true : options.singleQuote,
                };

                let docs = await textToDoc(
                    forceIntoExpression(
                        // If we have snipped content, it was done wrongly and we need to unsnip it.
                        // This happens for example for {@html `<script>{foo}</script>`}
                        getText(node, options, true),
                    ),
                    embeddedOptions,
                );
                if (node.forceSingleLine) {
                    docs = removeLines(docs);
                }
                if (node.removeParentheses) {
                    docs = removeParentheses(docs);
                }
                return docs;
            } catch (e) {
                return getText(node, options, true);
            }
        };
    }

    const embedType = (
        tag: 'script' | 'style' | 'template',
        parser: 'typescript' | 'babel-ts' | 'css' | 'scss' | 'less' | 'pug' | 'json',
        isTopLevel: boolean,
    ) => {
        return async (
            textToDoc: (text: string, options: Options) => Promise<Doc>,
            print: PrintFn,
        ): Promise<Doc> => {
            return embedTag(
                tag,
                options.originalText,
                path,
                (content) => formatBodyContent(content, parser, textToDoc, options),
                print,
                isTopLevel,
                options,
            );
        };
    };

    const embedScript = (isTopLevel: boolean) =>
        embedType(
            'script',
            // Use babel-ts as fallback because the absence does not mean the content is not TS,
            // the user could have set the default language. babel-ts will format things a little
            // bit different though, especially preserving parentheses around dot notation which
            // fixes https://github.com/sveltejs/prettier-plugin-svelte/issues/218
            isTypeScript(node) ? 'typescript' : isJSON(node) ? 'json' : 'babel-ts',
            isTopLevel,
        );
    const embedStyle = (isTopLevel: boolean) =>
        embedType('style', isLess(node) ? 'less' : isScss(node) ? 'scss' : 'css', isTopLevel);
    const embedPug = () => embedType('template', 'pug', false);

    switch (node.type) {
        case 'Script':
            return embedScript(true);
        case 'Style':
            return embedStyle(true);
        case 'Element': {
            if (node.name === 'script') {
                return embedScript(false);
            } else if (node.name === 'style') {
                return embedStyle(false);
            } else if (isPugTemplate(node)) {
                return embedPug();
            }
        }
    }

    return null;
}

function forceIntoExpression(statement: string) {
    // note the trailing newline: if the statement ends in a // comment,
    // we can't add the closing bracket right afterwards
    return `(${statement}\n)`;
}

function preformattedBody(str: string): Doc {
    if (!str) {
        return '';
    }

    const firstNewline = /^[\t\f\r ]*\n/;
    const lastNewline = /\n[\t\f\r ]*$/;

    // If we do not start with a new line prettier might try to break the opening tag
    // to keep it together with the string. Use a literal line to skip indentation.
    return [literalline, str.replace(firstNewline, '').replace(lastNewline, ''), hardline];
}

function getSnippedContent(node: Node) {
    const encodedContent = getAttributeTextValue(snippedTagContentAttribute, node);

    if (encodedContent) {
        return base64ToString(encodedContent);
    } else {
        return '';
    }
}

async function formatBodyContent(
    content: string,
    parser: 'typescript' | 'babel-ts' | 'css' | 'scss' | 'less' | 'pug' | 'json',
    textToDoc: (text: string, options: object) => Promise<Doc>,
    options: ParserOptions & { pugTabWidth?: number },
) {
    try {
        const body = await textToDoc(content, { parser });

        if (parser === 'pug' && typeof body === 'string') {
            // Pug returns no docs but a final string.
            // Therefore prepend the line offsets
            const whitespace = options.useTabs
                ? '\t'
                : ' '.repeat(
                      options.pugTabWidth && options.pugTabWidth > 0
                          ? options.pugTabWidth
                          : options.tabWidth,
                  );
            const pugBody = body
                .split('\n')
                .map((line) => (line ? whitespace + line : line))
                .join('\n');
            return [hardline, pugBody];
        }

        const indentIfDesired = (doc: Doc) =>
            options.svelteIndentScriptAndStyle ? indent(doc) : doc;
        trimRight([body], isLine);
        return [indentIfDesired([hardline, body]), hardline];
    } catch (error) {
        if (process.env.PRETTIER_DEBUG) {
            throw error;
        }

        // We will wind up here if there is a syntax error in the embedded code. If we throw an error,
        // prettier will try to print the node with the printer. That will fail with a hard-to-interpret
        // error message (e.g. "Unsupported node type", referring to `<script>`).
        // Therefore, fall back on just returning the unformatted text.
        console.error(error);

        return preformattedBody(content);
    }
}

async function embedTag(
    tag: 'script' | 'style' | 'template',
    text: string,
    path: FastPath,
    formatBodyContent: (content: string) => Promise<Doc>,
    print: PrintFn,
    isTopLevel: boolean,
    options: ParserOptions,
) {
    const node: ScriptNode | StyleNode | ElementNode = path.getNode();
    const content =
        tag === 'template' ? printRaw(node as ElementNode, text) : getSnippedContent(node);
    const previousComments =
        node.type === 'Script' || node.type === 'Style'
            ? node.comments
            : [getLeadingComment(path)]
                  .filter(Boolean)
                  .map((comment) => ({ comment: comment as CommentNode, emptyLineAfter: false }));

    const canFormat =
        isNodeSupportedLanguage(node) &&
        !isIgnoreDirective(previousComments[previousComments.length - 1]?.comment) &&
        (tag !== 'template' ||
            options.plugins.some(
                (plugin) => typeof plugin !== 'string' && plugin.parsers && plugin.parsers.pug,
            ));
    const body: Doc = canFormat
        ? content.trim() !== ''
            ? await formatBodyContent(content)
            : content === ''
            ? ''
            : hardline
        : preformattedBody(content);

    const openingTag = group([
        '<',
        tag,
        indent(
            group([
                ...path.map(printWithPrependedAttributeLine(node, options, print), 'attributes'),
                isBracketSameLine(options) ? '' : dedent(softline),
            ]),
        ),
        '>',
    ]);
    let result: Doc = group([openingTag, body, '</', tag, '>']);

    const comments = [];
    for (const comment of previousComments) {
        comments.push('<!--', comment.comment.data, '-->');
        comments.push(hardline);
        if (comment.emptyLineAfter) {
            comments.push(hardline);
        }
    }

    if (isTopLevel && options.svelteSortOrder !== 'none') {
        // top level embedded nodes have been moved from their normal position in the
        // node tree. if there is a comment referring to it, it must be recreated at
        // the new position.
        return [...comments, result, hardline];
    } else {
        // Only comments at the top level get the special "move comment" treatment.
        return isTopLevel && comments.length ? [...comments, result] : result;
    }
}

function printJS(
    node: any,
    forceSingleQuote: boolean,
    forceSingleLine: boolean,
    removeParentheses: boolean,
    name: string,
) {
    if (!node[name] || typeof node[name] !== 'object') {
        return;
    }
    node[name].isJS = true;
    node[name].forceSingleQuote = forceSingleQuote;
    node[name].forceSingleLine = forceSingleLine;
    node[name].removeParentheses = removeParentheses;
}
