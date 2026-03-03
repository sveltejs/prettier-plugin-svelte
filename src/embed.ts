import { Doc, doc, AstPath, Options, util } from 'prettier';
import { getText } from './lib/getText';
import { snippedTagContentAttribute } from './lib/snipTagContent';
import { isBracketSameLine, ParserOptions } from './options';
import { PrintFn } from './print';
import { isLine, removeParentheses, trimRight } from './print/doc-helpers';
import { isASTNode, printWithPrependedAttributeLine } from './print/helpers';
import {
    assignCommentsToNodes,
    getAttributeTextValue,
    getChildren,
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
import {
    ASTNode,
    BaseNode,
    CommentNode,
    ElementNode,
    Node,
    ScriptNode,
    StyleNode,
} from './print/nodes';
import { base64ToString } from './base64-string';
import { AST } from 'svelte/compiler';

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
export function embed(path: AstPath, _options: Options) {
    const node = path.getNode() as any;
    const options = _options as ParserOptions;
    if (!options.locStart || !options.locEnd || !options.originalText) {
        throw new Error('Missing required options');
    }

    if (isASTNode(node)) {
        assignCommentsToNodes(node);
        attachAttributeComments(node);
        return null;
    }

    // embed does depth first traversal with deepest node called first, therefore we need to
    // check the parent to see if we are inside an expression that should be embedded.
    const parent = path.getParentNode() as any;
    const printJsExpression = () =>
        (parent as any).expression ? printJS(parent, 'expression', {}) : undefined;
    const printSvelteBlockJS = (name: string) => printJS(parent, name, { forceSingleLine: true });

    switch (parent.type) {
        case 'IfBlock':
        case 'AwaitBlock':
        case 'KeyBlock':
            printSvelteBlockJS(parent.type === 'IfBlock' ? 'test' : 'expression');
            break;
        case 'EachBlock':
            printSvelteBlockJS('expression');
            printSvelteBlockJS('key');
            break;
        case 'SnippetBlock':
            // We merge the two parts into one expression to then treat it like a function
            if (node === parent.expression) {
                parent.expression.end =
                    options.originalText.indexOf(
                        ')',
                        (parent.parameters?.[parent.parameters.length - 1] as any)?.typeAnnotation
                            ?.end ??
                            parent.parameters?.[parent.parameters.length - 1]?.end ??
                            parent.expression.end,
                    ) + 1;
                parent.parameters = null;
                node.isJS = true;
                node.asFunction = true;
            }
            break;
        case 'RegularElement':
        case 'SvelteElement':
            printJS(parent, 'tag', {});
            break;
        case 'ExpressionTag':
            printJS(parent, 'expression', {
                forceSingleQuote: isInsideQuotedAttribute(path, options),
            });
            break;
        case 'HtmlTag':
            printJS(parent, 'expression', {});
            break;
        case 'SpreadAttribute':
            printJS(parent, 'expression', {});
            break;
        case 'AttachTag':
            printJS(parent, 'expression', {});
            break;
        case 'ConstTag':
            (parent as any).expression = (parent as AST.ConstTag).declaration.declarations[0];
            printJS(parent, 'expression', { removeParentheses: true });
            break;
        case 'BindDirective':
            printJS(parent, 'expression', {
                removeParentheses: parent.expression.type === 'SequenceExpression',
                surroundWithSoftline: true,
            });
            break;
        case 'RenderTag':
            if (node === parent.expression) {
                // TODO: remove this if block at some point, snippet API changed in .next-..
                if ('argument' in parent || 'arguments' in parent) {
                    parent.expression.end =
                        options.originalText.indexOf(
                            ')',
                            parent.argument?.end ??
                                parent.arguments?.[parent.arguments.length - 1]?.end ??
                                parent.expression.end,
                        ) + 1;
                    parent.argument = null;
                    parent.arguments = null;
                }
                printJS(parent, 'expression', {});
            }
            break;
        case 'OnDirective':
        case 'BindDirective':
        case 'ClassDirective':
        case 'LetDirective':
        case 'TransitionDirective':
        case 'UseDirective':
        case 'AnimateDirective':
        case 'SvelteComponent':
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
                    parser: options._svelte_ts
                        ? 'svelteTSExpressionParser'
                        : 'svelteExpressionParser',
                    singleQuote: node.forceSingleQuote ? true : options.singleQuote,
                    _svelte_asFunction: node.asFunction,
                };

                // If we have snipped content, it was done wrongly and we need to unsnip it.
                // This happens for example for {@html `<script>{foo}</script>`}
                const text = getText(node, options, true);
                let docs = await textToDoc(
                    node.asFunction ? forceIntoFunction(text) : forceIntoExpression(text),
                    embeddedOptions,
                );
                if (node.forceSingleLine) {
                    docs = removeLines(docs);
                }
                if (node.removeParentheses) {
                    docs = removeParentheses(docs);
                }
                if (node.asFunction) {
                    if (Array.isArray(docs) && typeof docs[0] === 'string') {
                        docs[0] = docs[0].replace('function ', '');
                        docs.splice(-1, 1);
                    } else {
                        throw new Error('Prettier AST changed, asFunction logic needs to change');
                    }
                }
                if (node.surroundWithSoftline) {
                    docs = group(indent([softline, group(docs), dedent(softline)]));
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
        case 'StyleSheet':
            return embedStyle(true);
        case 'RegularElement': {
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

function forceIntoFunction(statement: string) {
    return `function ${statement} {}`;
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
    path: AstPath,
    formatBodyContent: (content: string) => Promise<Doc>,
    print: PrintFn,
    isTopLevel: boolean,
    options: ParserOptions,
) {
    const node = path.getNode() as ScriptNode | StyleNode | ElementNode;
    const content =
        tag === 'template' ? printRaw(node as ElementNode, text) : getSnippedContent(node);
    const previousComments =
        node.type === 'Script' || node.type === 'StyleSheet'
            ? node.comments ?? []
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
    name: string,
    options: {
        forceSingleQuote?: boolean;
        forceSingleLine?: boolean;
        removeParentheses?: boolean;
        surroundWithSoftline?: boolean;
    },
) {
    const part = node[name] as BaseNode | undefined;
    if (!part || typeof part !== 'object') {
        return;
    }
    part.isJS = true;
    part.forceSingleQuote = options.forceSingleQuote;
    part.forceSingleLine = options.forceSingleLine;
    part.removeParentheses = options.removeParentheses;
    part.surroundWithSoftline = options.surroundWithSoftline;
}

/**
 * Walk the AST and use `_comments` (stashed by the parser) to attach
 * attribute-level comments to their neighbouring attribute nodes via
 * Prettier's `util.addLeadingComment` / `util.addTrailingComment`.
 */
function attachAttributeComments(ast: ASTNode): void {
    const comments: any[] | undefined = ast._comments;
    if (!comments || comments.length === 0) return;

    // Index comments by start position for fast lookup
    const commentsByStart = new Map<number, any>();
    for (const c of comments) {
        commentsByStart.set(c.start, c);
    }

    walkAndAttach(ast.fragment as any, commentsByStart);
}

function walkAndAttach(node: Node, commentsByStart: Map<number, any>): void {
    if (!node || typeof node !== 'object') return;

    if ('attributes' in node && Array.isArray(node.attributes) && node.attributes.length > 0) {
        const attrs = node.attributes;

        // Check gap before first attribute (between tag name and first attr)
        const tagNameEnd = node.start + 2;
        attachCommentsInRange(tagNameEnd, attrs[0].start, null, attrs[0], commentsByStart);

        // Check gaps between consecutive attributes
        for (let i = 0; i < attrs.length - 1; i++) {
            attachCommentsInRange(
                attrs[i].end,
                attrs[i + 1].start,
                attrs[i],
                attrs[i + 1],
                commentsByStart,
            );
        }
    }

    // Recurse into children and block branches
    for (const child of getChildren(node)) {
        walkAndAttach(child, commentsByStart);
    }

    if (node.type === 'IfBlock' && (node as any).alternate) {
        walkAndAttach((node as any).alternate, commentsByStart);
    }
    if (node.type === 'EachBlock' && (node as any).fallback) {
        walkAndAttach((node as any).fallback, commentsByStart);
    }
    if (node.type === 'AwaitBlock') {
        if ((node as any).pending) walkAndAttach((node as any).pending, commentsByStart);
        if ((node as any).then) walkAndAttach((node as any).then, commentsByStart);
        if ((node as any).catch) walkAndAttach((node as any).catch, commentsByStart);
    }
}

function attachCommentsInRange(
    rangeStart: number,
    rangeEnd: number,
    precedingAttr: any | null,
    followingAttr: any | null,
    commentsByStart: Map<number, any>,
): void {
    for (const [start, comment] of commentsByStart) {
        if (start >= rangeStart && comment.end <= rangeEnd) {
            if (followingAttr) {
                util.addLeadingComment(followingAttr, comment);
            } else if (precedingAttr) {
                util.addTrailingComment(precedingAttr, comment);
            }
            commentsByStart.delete(start);
        }
    }
}
