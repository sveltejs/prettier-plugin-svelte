import { Doc, doc, AstPath } from 'prettier';
import { formattableAttributes, selfClosingTags } from '../lib/elements';
import { hasSnippedContent, unsnipContent } from '../lib/snipTagContent';
import { isBracketSameLine, ParserOptions, parseSortOrder, SortOrderPart } from '../options';
import { isEmptyDoc, isLine, trim, trimRight } from './doc-helpers';
import {
    flatten,
    getAttributeLine,
    isASTNode,
    isPreTagContent,
    printWithPrependedAttributeLine,
    replaceEndOfLineWith,
} from './helpers';
import {
    canOmitSoftlineBeforeClosingTag,
    checkWhitespaceAtEndOfFragment,
    checkWhitespaceAtStartOfFragment,
    doesEmbedStartAfterNode,
    endsWithLinebreak,
    getChildren,
    getNextNode,
    getUnencodedText,
    isBlockElement,
    isEmptyTextNode,
    isIgnoreDirective,
    isIgnoreEndDirective,
    isIgnoreStartDirective,
    isInlineElement,
    isLoneExpressionTag,
    isNodeSupportedLanguage,
    isNodeTopLevelHTML,
    isOrCanBeConvertedToShorthand,
    isTextNodeEndingWithLinebreak,
    isTextNodeEndingWithWhitespace,
    isTextNodeStartingWithLinebreak,
    isTextNodeStartingWithWhitespace,
    printRaw,
    shouldHugEnd,
    shouldHugStart,
    startsWithLinebreak,
    trimChildren,
    trimTextNodeLeft,
    trimTextNodeRight,
} from './node-helpers';
import { Fragment, Root, SvelteNode, Text } from './nodes';

const { join, line, group, indent, dedent, softline, hardline, fill, breakParent, literalline } =
    doc.builders;

export type PrintFn = (path: AstPath) => Doc;

declare module 'prettier' {
    export namespace doc {
        namespace builders {
            interface Line {
                keepIfLonely?: boolean;
            }
        }
    }
}

export function hasPragma(text: string) {
    return /^\s*<!--\s*@(format|prettier)\W/.test(text);
}

let ignoreNext = false;
let ignoreRange = false;

export function print(path: AstPath, options: ParserOptions, print: PrintFn): Doc {
    const bracketSameLine = isBracketSameLine(options);

    const n = path.getValue();
    if (!n) {
        return '';
    }

    if (isASTNode(n)) {
        return printTopLevelParts(n, options, path, print);
    }

    const [open, close] = ['{', '}'];
    const printJsExpression = () => [open, printJS(path, print, 'expression'), close];
    const node = n as SvelteNode;

    if (
        (ignoreNext || (ignoreRange && !isIgnoreEndDirective(node))) &&
        (node.type !== 'Text' || !isEmptyTextNode(node))
    ) {
        if (ignoreNext) {
            ignoreNext = false;
        }
        return flatten(
            options.originalText
                .slice(options.locStart(node), options.locEnd(node))
                .split('\n')
                .map((o, i) => (i == 0 ? [o] : [literalline, o])),
        );
    }

    switch (node.type) {
        case 'Fragment':
            const children = node.nodes;

            if (children.length === 0 || children.every(isEmptyTextNode)) {
                return '';
            }
            if (!isPreTagContent(path)) {
                trimChildren(node.nodes, path);
                let shouldBreakParent = false;
                const output = trim([printChildren(path, print, options)], (n) => {
                    // Because printChildren may append this at the end and
                    // may hide other lines before it
                    if (n === breakParent) {
                        shouldBreakParent = true;
                        return true;
                    }

                    return isLine(n) || (typeof n === 'string' && n.trim() === '');
                });
                if (shouldBreakParent) {
                    output.push(breakParent);
                }
                if (output.every((doc) => isEmptyDoc(doc))) {
                    return '';
                }
                //                return group([...output, hardline]);
                return group(output);
            } else {
                return group(path.map(print, 'children'));
            }
        case 'Text':
            if (!isPreTagContent(path)) {
                if (isEmptyTextNode(node)) {
                    const hasWhiteSpace =
                        getUnencodedText(node).trim().length < getUnencodedText(node).length;
                    const hasOneOrMoreNewlines = /\n/.test(getUnencodedText(node));
                    const hasTwoOrMoreNewlines = /\n\r?\s*\n\r?/.test(getUnencodedText(node));
                    if (hasTwoOrMoreNewlines) {
                        return [hardline, hardline];
                    }
                    if (hasOneOrMoreNewlines) {
                        return hardline;
                    }
                    if (hasWhiteSpace) {
                        return line;
                    }
                    return '';
                }

                /**
                 * For non-empty text nodes each sequence of non-whitespace characters (effectively,
                 * each "word") is joined by a single `line`, which will be rendered as a single space
                 * until this node's current line is out of room, at which `fill` will break at the
                 * most convenient instance of `line`.
                 */
                return fill(splitTextToDocs(node));
            } else {
                let rawText = getUnencodedText(node);
                const parent = path.getParentNode();
                if (parent.type === 'Attribute') {
                    // Direct child of attribute value -> add literallines at end of lines
                    // so that other things don't break in unexpected places
                    if (
                        parent.name === 'class' &&
                        path.getParentNode(1).type === 'RegularElement'
                    ) {
                        // Special treatment for class attribute on html elements. Prettier
                        // will force everything into one line, we deviate from that and preserve lines.
                        rawText = rawText.replace(
                            /([^ \t\n])(([ \t]+$)|([ \t]+(\r?\n))|[ \t]+)/g,
                            // Remove trailing whitespace in lines with non-whitespace characters
                            // except at the end of the string
                            (
                                match,
                                characterBeforeWhitespace,
                                _,
                                isEndOfString,
                                isEndOfLine,
                                endOfLine,
                            ) =>
                                isEndOfString
                                    ? match
                                    : characterBeforeWhitespace + (isEndOfLine ? endOfLine : ' '),
                        );
                        // Shrink trailing whitespace in case it's followed by a expression tag
                        // and remove it completely if it's at the end of the string, but not
                        // if it's on its own line
                        rawText = rawText.replace(
                            /([^ \t\n])[ \t]+$/,
                            parent.value.indexOf(node) === parent.value.length - 1 ? '$1' : '$1 ',
                        );
                    }
                    return replaceEndOfLineWith(rawText, literalline);
                }
                return rawText;
            }
        case 'RegularElement':
        case 'SvelteElement':
        case 'SvelteSelf':
        case 'Component':
        case 'SvelteComponent':
        case 'SlotElement':
        case 'SvelteFragment':
        case 'SvelteWindow':
        case 'SvelteHead':
        case 'TitleElement': {
            const isSupportedLanguage = !(
                node.name === 'template' && !isNodeSupportedLanguage(node)
            );
            const isEmpty = node.fragment.nodes.every((child) => isEmptyTextNode(child));
            const isDoctypeTag = node.name.toUpperCase() === '!DOCTYPE';
            const didSelfClose = options.originalText[node.end - 2] === '/';

            const isSelfClosingTag =
                isEmpty &&
                (((((node.type === 'RegularElement' || node.type === 'SvelteElement') &&
                    !options.svelteStrictMode) ||
                    node.type === 'SvelteHead' ||
                    node.type === 'SvelteSelf' ||
                    node.type === 'SvelteComponent' ||
                    node.type === 'Component' ||
                    node.type === 'SlotElement' ||
                    node.type === 'SvelteFragment' ||
                    node.type === 'TitleElement') &&
                    didSelfClose) ||
                    node.type === 'SvelteWindow' ||
                    selfClosingTags.indexOf(node.name) !== -1 ||
                    isDoctypeTag);

            // Order important: print attributes first
            const attributes = path.map(
                printWithPrependedAttributeLine(node, options, print),
                'attributes',
            );
            const attributeLine = getAttributeLine(node, options);
            const possibleThisBinding =
                node.type === 'SvelteComponent'
                    ? [attributeLine, 'this=', ...printJsExpression()]
                    : node.type === 'SvelteElement'
                    ? [
                          attributeLine,
                          'this=',
                          ...(node.tag.type === 'Literal' && typeof node.tag.loc === 'undefined'
                              ? [`"${node.tag.value}"`]
                              : [open, printJS(path, print, 'tag'), close]),
                      ]
                    : '';

            if (isSelfClosingTag) {
                return group([
                    '<',
                    node.name,

                    indent(
                        group([
                            possibleThisBinding,
                            ...attributes,
                            bracketSameLine || isDoctypeTag ? '' : dedent(line),
                        ]),
                    ),

                    ...[bracketSameLine && !isDoctypeTag ? ' ' : '', `${isDoctypeTag ? '' : '/'}>`],
                ]);
            }

            const children = node.fragment.nodes;
            const firstChild = children[0];
            const lastChild = children[children.length - 1];

            //todo
            // Is a function which is invoked later because printChildren will manipulate child nodes
            // which would wrongfully change the other checks about hugging etc done beforehand
            let body: () => Doc;

            const hugStart = shouldHugStart(node, isSupportedLanguage, options);
            const hugEnd = shouldHugEnd(node, isSupportedLanguage, options);

            if (isEmpty) {
                body =
                    isInlineElement(path, options, node) &&
                    node.fragment.nodes.length &&
                    isTextNodeStartingWithWhitespace(node.fragment.nodes[0]) &&
                    !isPreTagContent(path)
                        ? () => line
                        : () => (bracketSameLine ? softline : '');
            } else if (isPreTagContent(path)) {
                body = () => printPre(node, options.originalText, path, print);
            } else if (!isSupportedLanguage) {
                body = () => printRaw(node, options.originalText, true);
            } else if (isInlineElement(path, options, node) && !isPreTagContent(path)) {
                body = () => path.call(print, 'fragment');
            } else {
                body = () => path.call(print, 'fragment');
            }

            const openingTag = [
                '<',
                node.name,

                indent(
                    group([
                        possibleThisBinding,
                        ...attributes,
                        hugStart && !isEmpty
                            ? ''
                            : !bracketSameLine && !isPreTagContent(path)
                            ? dedent(softline)
                            : '',
                    ]),
                ),
            ];

            if (!isSupportedLanguage && !isEmpty) {
                // Format template tags so that there's a hardline but no indention.
                // That way the `lang="X"` and the closing `>` of the start tag stay in one line
                // which is the 99% use case.
                return group([
                    ...openingTag,
                    '>',
                    group([hardline, body(), hardline]),
                    `</${node.name}>`,
                ]);
            }

            if (hugStart && hugEnd) {
                const huggedContent = [softline, group(['>', body(), `</${node.name}`])];
                const omitSoftlineBeforeClosingTag =
                    (isEmpty && !bracketSameLine) ||
                    canOmitSoftlineBeforeClosingTag(node, path, options);
                return group([
                    ...openingTag,
                    isEmpty ? group(huggedContent) : group(indent(huggedContent)),
                    omitSoftlineBeforeClosingTag ? '' : softline,
                    '>',
                ]);
            }

            // No hugging of content means it's either a block element and/or there's whitespace at the start/end
            let noHugSeparatorStart: Doc = softline;
            let noHugSeparatorEnd: Doc = softline;
            if (isPreTagContent(path)) {
                noHugSeparatorStart = '';
                noHugSeparatorEnd = '';
            } else {
                let didSetEndSeparator = false;

                if (!hugStart && firstChild && firstChild.type === 'Text') {
                    if (
                        isTextNodeStartingWithLinebreak(firstChild) &&
                        firstChild !== lastChild &&
                        (!isInlineElement(path, options, node) ||
                            isTextNodeEndingWithWhitespace(lastChild))
                    ) {
                        noHugSeparatorStart = hardline;
                        noHugSeparatorEnd = hardline;
                        didSetEndSeparator = true;
                    } else if (isInlineElement(path, options, node)) {
                        noHugSeparatorStart = line;
                    }
                    trimTextNodeLeft(firstChild);
                }
                if (!hugEnd && lastChild && lastChild.type === 'Text') {
                    if (isInlineElement(path, options, node) && !didSetEndSeparator) {
                        noHugSeparatorEnd = line;
                    }
                    trimTextNodeRight(lastChild);
                }
            }

            if (hugStart) {
                return group([
                    ...openingTag,
                    indent([softline, group(['>', body()])]),
                    noHugSeparatorEnd,
                    `</${node.name}>`,
                ]);
            }

            if (hugEnd) {
                return group([
                    ...openingTag,
                    '>',
                    indent([noHugSeparatorStart, group([body(), `</${node.name}`])]),
                    canOmitSoftlineBeforeClosingTag(node, path, options) ? '' : softline,
                    '>',
                ]);
            }

            if (isEmpty) {
                return group([...openingTag, '>', body(), `</${node.name}>`]);
            }

            return group([
                ...openingTag,
                '>',
                indent([noHugSeparatorStart, body()]),
                noHugSeparatorEnd,
                `</${node.name}>`,
            ]);
        }
        case 'SvelteOptions':
            const comments = [];
            for (const comment of node.comments) {
                comments.push('<!--', comment.comment.data, '-->');
                comments.push(hardline);
                if (comment.emptyLineAfter) {
                    comments.push(hardline);
                }
            }

            return [
                comments,
                group([
                    [
                        '<svelte:options',
                        indent(
                            group([
                                ...path.map(
                                    printWithPrependedAttributeLine(node, options, print),
                                    'attributes',
                                ),
                                bracketSameLine ? '' : dedent(line),
                            ]),
                        ),
                        ...[bracketSameLine ? ' ' : '', '/>'],
                    ],
                    //                hardline,
                ]),
            ];
        // else fall through to Body
        case 'SvelteBody':
        case 'SvelteDocument':
            return group([
                '<',
                node.name,
                indent(
                    group([
                        ...path.map(
                            printWithPrependedAttributeLine(node, options, print),
                            'attributes',
                        ),
                        bracketSameLine ? '' : dedent(line),
                    ]),
                ),
                ...[bracketSameLine ? ' ' : '', '/>'],
            ]);
        case 'Identifier':
            return node.name;
        case 'Attribute': {
            if (isOrCanBeConvertedToShorthand(node)) {
                if (options.svelteAllowShorthand) {
                    return ['{', node.name, '}'];
                } else {
                    return [node.name, `=${open}`, node.name, close];
                }
            } else {
                if (node.value === true) {
                    return [node.name];
                }

                const quotes = !isLoneExpressionTag(node.value);
                const attrNodeValue = printAttributeNodeValue(path, print, quotes, node);
                if (quotes) {
                    return [node.name, '=', '"', attrNodeValue, '"'];
                } else {
                    return [node.name, '=', attrNodeValue];
                }
            }
        }
        case 'ExpressionTag':
            return ['{', printJS(path, print, 'expression'), '}'];
        case 'IfBlock': {
            let def: Doc[] = [
                node.elseif ? '{:else ' : '{#',
                'if ',
                printJS(path, print, 'test'),
                '}',
                printSvelteBlockFragment(path, print, 'consequent'),
            ];

            if (node.alternate) {
                const alternateNodes = node.alternate.nodes;
                if (
                    alternateNodes.length !== 1 ||
                    alternateNodes[0].type !== 'IfBlock' ||
                    !alternateNodes[0].elseif
                ) {
                    def.push('{:else}');
                }

                def.push(printSvelteBlockFragment(path, print, 'alternate', node.elseif));
            }

            if (node.elseif) {
                def = dedent(def);
            } else {
                def.push('{/if}');
            }

            return group([def, breakParent]);
        }
        case 'EachBlock': {
            const def: Doc[] = [
                '{#each ',
                printJS(path, print, 'expression'),
                ' as',
                expandNode(node.context, options.originalText),
            ];

            if (node.index) {
                def.push(', ', node.index);
            }

            if (node.key) {
                def.push(' (', printJS(path, print, 'key'), ')');
            }

            def.push('}', printSvelteBlockFragment(path, print, 'body'));

            if (node.fallback) {
                def.push('{:else}', printSvelteBlockFragment(path, print, 'fallback'));
            }

            def.push('{/each}');

            return group([def, breakParent]);
        }
        case 'AwaitBlock': {
            const hasPendingBlock = (node.pending?.nodes ?? []).some((n) => !isEmptyTextNode(n));
            const hasThenBlock = (node.then?.nodes ?? []).some((n) => !isEmptyTextNode(n));
            const hasCatchBlock = (node.catch?.nodes ?? []).some((n) => !isEmptyTextNode(n));

            let block = [];

            if (!hasPendingBlock && hasThenBlock) {
                block.push(
                    group([
                        '{#await ',
                        printJS(path, print, 'expression'),
                        ' then',
                        expandNode(node.value, options.originalText),
                        '}',
                    ]),
                    printSvelteBlockFragment(path, print, 'then'),
                );
            } else if (!hasPendingBlock && hasCatchBlock) {
                block.push(
                    group([
                        '{#await ',
                        printJS(path, print, 'expression'),
                        ' catch',
                        expandNode(node.error, options.originalText),
                        '}',
                    ]),
                    printSvelteBlockFragment(path, print, 'catch'),
                );
            } else {
                block.push(group(['{#await ', printJS(path, print, 'expression'), '}']));

                if (hasPendingBlock) {
                    block.push(printSvelteBlockFragment(path, print, 'pending'));
                }

                if (hasThenBlock) {
                    block.push(
                        group(['{:then', expandNode(node.value, options.originalText), '}']),
                        printSvelteBlockFragment(path, print, 'then'),
                    );
                }
            }

            if ((hasPendingBlock || hasThenBlock) && hasCatchBlock) {
                block.push(
                    group(['{:catch', expandNode(node.error, options.originalText), '}']),
                    printSvelteBlockFragment(path, print, 'catch'),
                );
            }

            block.push('{/await}');

            return group(block);
        }
        case 'KeyBlock': {
            const def: Doc[] = [
                '{#key ',
                printJS(path, print, 'expression'),
                '}',
                printSvelteBlockFragment(path, print, 'fragment'),
            ];

            def.push('{/key}');

            return group([def, breakParent]);
        }
        case 'SnippetBlock': {
            const snippet = ['{#snippet ', printJS(path, print, 'expression')];
            snippet.push('}', printSvelteBlockFragment(path, print, 'body'), '{/snippet}');
            return snippet;
        }
        case 'OnDirective':
            return [
                'on:',
                node.name,
                node.modifiers && node.modifiers.length ? ['|', join('|', node.modifiers)] : '',
                node.expression ? ['=', ...printJsExpression()] : '',
            ];
        case 'BindDirective':
            return [
                'bind:',
                node.name,
                node.expression.type === 'Identifier' &&
                node.expression.name === node.name &&
                options.svelteAllowShorthand
                    ? ''
                    : ['=', ...printJsExpression()],
            ];
        case 'ClassDirective':
            return [
                'class:',
                node.name,
                node.expression.type === 'Identifier' &&
                node.expression.name === node.name &&
                options.svelteAllowShorthand
                    ? ''
                    : ['=', ...printJsExpression()],
            ];
        case 'StyleDirective':
            const prefix = [
                'style:',
                node.name,
                node.modifiers && node.modifiers.length ? ['|', join('|', node.modifiers)] : '',
            ];

            if (isOrCanBeConvertedToShorthand(node) || node.value === true) {
                if (options.svelteAllowShorthand) {
                    return [...prefix];
                } else {
                    return [...prefix, `=${open}`, node.name, close];
                }
            } else {
                const quotes = !isLoneExpressionTag(node.value);
                const attrNodeValue = printAttributeNodeValue(path, print, quotes, node);
                if (quotes) {
                    return [...prefix, '=', '"', attrNodeValue, '"'];
                } else {
                    return [...prefix, '=', attrNodeValue];
                }
            }
        case 'LetDirective':
            return [
                'let:',
                node.name,
                // shorthand let directives have `null` expressions
                !node.expression ||
                (node.expression.type === 'Identifier' && node.expression.name === node.name)
                    ? ''
                    : ['=', ...printJsExpression()],
            ];
        case 'DebugTag':
            return [
                '{@debug',
                node.identifiers.length > 0
                    ? [' ', join(', ', path.map(print, 'identifiers'))]
                    : '',
                '}',
            ];
        case 'Comment': {
            const nodeAfterComment = getNextNode(path);

            if (isIgnoreStartDirective(node) && isNodeTopLevelHTML(node, path)) {
                ignoreRange = true;
            } else if (isIgnoreEndDirective(node) && isNodeTopLevelHTML(node, path)) {
                ignoreRange = false;
            } else if (
                // If there is no sibling node that starts right after us but the parent indicates
                // that there used to be, that means that node was actually an embedded `<style>`
                // or `<script>` node that was cut out.
                // If so, the comment does not refer to the next line we will see.
                // The `embed` function handles printing the comment in the right place.
                doesEmbedStartAfterNode(node, path) ||
                (isEmptyTextNode(nodeAfterComment) &&
                    doesEmbedStartAfterNode(nodeAfterComment, path))
            ) {
                return '';
            } else if (isIgnoreDirective(node)) {
                ignoreNext = true;
            }

            let text = node.data;

            if (hasSnippedContent(text)) {
                text = unsnipContent(text);
            }

            return group(['<!--', text, '-->']);
        }
        case 'TransitionDirective':
            const kind = node.intro && node.outro ? 'transition' : node.intro ? 'in' : 'out';
            return [
                kind,
                ':',
                node.name,
                node.modifiers && node.modifiers.length ? ['|', join('|', node.modifiers)] : '',
                node.expression ? ['=', ...printJsExpression()] : '',
            ];
        case 'UseDirective':
            return ['use:', node.name, node.expression ? ['=', ...printJsExpression()] : ''];
        case 'AnimateDirective':
            return ['animate:', node.name, node.expression ? ['=', ...printJsExpression()] : ''];
        case 'HtmlTag':
            return ['{@html ', printJS(path, print, 'expression'), '}'];
        case 'RenderTag': {
            const render = ['{@render ', printJS(path, print, 'expression'), '}'];
            return render;
        }
        case 'SpreadAttribute':
            return ['{...', printJS(path, print, 'expression'), '}'];
        case 'ConstTag':
            return ['{@', printJS(path, print, 'declaration'), '}'];
    }

    console.error(JSON.stringify(node, null, 4));
    throw new Error('unknown node type: ' + node.type);
}

function printTopLevelParts(n: Root, options: ParserOptions, path: AstPath, print: PrintFn): Doc {
    if (options.svelteSortOrder === 'none') {
        const topLevelPartsByEnd: Record<number, any> = {};

        if (n.options) {
            topLevelPartsByEnd[n.options.end] = n.options;
        }
        if (n.module) {
            topLevelPartsByEnd[n.module.end] = n.module;
        }
        if (n.instance) {
            topLevelPartsByEnd[n.instance.end] = n.instance;
        }
        if (n.css) {
            topLevelPartsByEnd[n.css.end] = n.css;
        }

        const children = getChildren(n);
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (topLevelPartsByEnd[node.start]) {
                children.splice(i, 0, topLevelPartsByEnd[node.start]);
                delete topLevelPartsByEnd[node.start];
            }
        }

        const result = [path.call(print, 'fragment'), hardline];
        if (options.insertPragma && !hasPragma(options.originalText)) {
            return [`<!-- @format -->`, hardline, result];
        } else {
            return result;
        }
    }

    const parts: Record<SortOrderPart, Doc[]> = {
        options: [],
        scripts: [],
        markup: [],
        styles: [],
    };

    if (n.options) {
        const svelteOptionsDoc = [path.call(print, 'options'), hardline];
        parts.options.push(svelteOptionsDoc);
    }

    if (n.module) {
        parts.scripts.push(path.call(print, 'module'));
    }
    if (n.instance) {
        parts.scripts.push(path.call(print, 'instance'));
    }

    const htmlDoc = path.call(print, 'fragment');
    if (htmlDoc) {
        parts.markup.push([htmlDoc, hardline]);
    }

    if (n.css) {
        parts.styles.push(path.call(print, 'css'));
    }

    const docs = flatten(parseSortOrder(options.svelteSortOrder).map((p) => parts[p]));

    // Need to reset these because they are global and could affect the next formatting run
    ignoreNext = false;
    ignoreRange = false;

    // If this is invoked as an embed of markdown, remove the last hardline.
    // The markdown parser tries this, too, but fails because it does not
    // recurse into concats. Doing this will prevent an empty line
    // at the end of the embedded code block.
    if (options.parentParser === 'markdown') {
        const lastDoc = docs[docs.length - 1];
        trimRight([lastDoc], isLine);
    }

    if (options.insertPragma && !hasPragma(options.originalText)) {
        return [`<!-- @format -->`, hardline, group(docs)];
    } else {
        return group([join(hardline, docs)]);
    }
}

function printAttributeNodeValue(
    path: AstPath<any>,
    print: PrintFn,
    quotes: boolean,
    node: AttributeNode | StyleDirectiveNode,
) {
    const valueDocs = path.map((childPath) => childPath.call(print), 'value');

    if (!quotes || !formattableAttributes.includes(node.name)) {
        return valueDocs;
    } else {
        return indent(group(trim(valueDocs, isLine)));
    }
}

function printSvelteBlockFragment(
    path: AstPath,
    print: PrintFn,
    name: string,
    shouldIndent = true,
): Doc {
    const node = path.node[name] as Fragment;

    const children = node.nodes;
    if (!children || children.length === 0) {
        return '';
    }

    const whitespaceAtStartOfFragment = checkWhitespaceAtStartOfFragment(node);
    const whitespaceAtEndOfFragment = checkWhitespaceAtEndOfFragment(node);
    const startline =
        whitespaceAtStartOfFragment === 'none'
            ? ''
            : whitespaceAtEndOfFragment === 'line' || whitespaceAtStartOfFragment === 'line'
            ? hardline
            : line;
    const endline =
        whitespaceAtEndOfFragment === 'none'
            ? ''
            : whitespaceAtEndOfFragment === 'line' || whitespaceAtStartOfFragment === 'line'
            ? hardline
            : line;

    const firstChild = children[0];
    const lastChild = children[children.length - 1];
    if (isTextNodeStartingWithWhitespace(firstChild)) {
        trimTextNodeLeft(firstChild);
    }
    if (isTextNodeEndingWithWhitespace(lastChild)) {
        trimTextNodeRight(lastChild);
    }

    //    return [indent([startline, group(printChildren(path, print, options))]), endline];
    return shouldIndent
        ? [indent([startline, group(path.call(print, name))]), endline]
        : [startline, group(path.call(print, name)), endline];
}

function printPre(
    node: Parameters<typeof printRaw>[0],
    originalText: string,
    path: AstPath,
    print: PrintFn,
): Doc {
    const result: Doc = [];
    const length = node.fragment.nodes.length;
    for (let i = 0; i < length; i++) {
        const child = node.fragment.nodes[i];
        if (child.type === 'Text') {
            const lines = originalText.substring(child.start, child.end).split(/\r?\n/);
            lines.forEach((line, j) => {
                if (j > 0) result.push(literalline);
                result.push(line);
            });
        } else {
            result.push(path.call(print, 'fragment', 'nodes', i));
        }
    }
    return result;
}

//should get fragment
function printChildren(path: AstPath, print: PrintFn, options: ParserOptions): Doc {
    if (isPreTagContent(path)) {
        return path.map(print, 'nodes');
    }

    const childNodes = path.getValue().nodes;
    if (childNodes.length === 0) {
        return '';
    }

    const childDocs: Doc[] = [];
    let handleWhitespaceOfPrevTextNode = false;

    for (let i = 0; i < childNodes.length; i++) {
        const childNode = childNodes[i];
        if (childNode.type === 'Text') {
            handleTextChild(i, childNode);
        } else if (isBlockElement(childNode, options)) {
            handleBlockChild(i);
        } else if (isInlineElement(path, options, childNode)) {
            handleInlineChild(i);
        } else {
            childDocs.push(printChild(i));
            handleWhitespaceOfPrevTextNode = false;
        }
    }

    // If there's at least one block element and more than one node, break content
    const forceBreakContent =
        childNodes.length > 1 && childNodes.some((child) => isBlockElement(child, options));
    if (forceBreakContent) {
        childDocs.push(breakParent);
    }

    return childDocs;

    function printChild(idx: number): Doc {
        return path.call(print, 'nodes', idx);
    }

    /**
     * Print inline child. Hug whitespace of previous text child if there was one.
     */
    function handleInlineChild(idx: number) {
        if (handleWhitespaceOfPrevTextNode) {
            childDocs.push(group([line, printChild(idx)]));
        } else {
            childDocs.push(printChild(idx));
        }
        handleWhitespaceOfPrevTextNode = false;
    }

    /**
     * Print block element. Add softlines around it if needed
     * so it breaks into a separate line if children are broken up.
     * Don't add lines at the start/end if it's the first/last child because this
     * kind of whitespace handling is done in the parent already.
     */
    function handleBlockChild(idx: number) {
        const prevChild = childNodes[idx - 1];
        if (
            prevChild &&
            !isBlockElement(prevChild, options) &&
            (prevChild.type !== 'Text' ||
                handleWhitespaceOfPrevTextNode ||
                !isTextNodeEndingWithWhitespace(prevChild))
        ) {
            childDocs.push(softline);
        }

        childDocs.push(printChild(idx));

        const nextChild = childNodes[idx + 1];
        if (
            nextChild &&
            (nextChild.type !== 'Text' ||
                // Only handle text which starts with a whitespace and has text afterwards,
                // or is empty but followed by an inline element. The latter is done
                // so that if the children break, the inline element afterwards is in a separate line.
                ((!isEmptyTextNode(nextChild) ||
                    (childNodes[idx + 2] && isInlineElement(path, options, childNodes[idx + 2]))) &&
                    !isTextNodeStartingWithLinebreak(nextChild)))
        ) {
            childDocs.push(softline);
        }
        handleWhitespaceOfPrevTextNode = false;
    }

    /**
     * Print text child. First/last child white space handling
     * is done in parent already. By definition of the Svelte AST,
     * a text node always is inbetween other tags. Add hardlines
     * if the users wants to have them inbetween.
     * If the text is trimmed right, toggle flag telling
     * subsequent (inline)block element to alter its printing logic
     * to check if they need to hug or print lines themselves.
     */
    function handleTextChild(idx: number, childNode: Text) {
        handleWhitespaceOfPrevTextNode = false;

        if (idx === 0 || idx === childNodes.length - 1) {
            childDocs.push(printChild(idx));
            return;
        }

        const prevNode = childNodes[idx - 1];
        const nextNode = childNodes[idx + 1];

        if (
            isTextNodeStartingWithWhitespace(childNode) &&
            // If node is empty, go straight through to checking the right end
            !isEmptyTextNode(childNode)
        ) {
            if (
                isInlineElement(path, options, prevNode) &&
                !isTextNodeStartingWithLinebreak(childNode)
            ) {
                trimTextNodeLeft(childNode);
                const lastChildDoc = childDocs.pop()!;
                childDocs.push(group([lastChildDoc, line]));
            }

            if (isBlockElement(prevNode, options) && !isTextNodeStartingWithLinebreak(childNode)) {
                trimTextNodeLeft(childNode);
            }
        }

        if (isTextNodeEndingWithWhitespace(childNode)) {
            if (
                isInlineElement(path, options, nextNode) &&
                !isTextNodeEndingWithLinebreak(childNode)
            ) {
                handleWhitespaceOfPrevTextNode = !prevNode || !isBlockElement(prevNode, options);
                trimTextNodeRight(childNode);
            }
            if (isBlockElement(nextNode, options) && !isTextNodeEndingWithLinebreak(childNode, 2)) {
                handleWhitespaceOfPrevTextNode = !prevNode || !isBlockElement(prevNode, options);
                trimTextNodeRight(childNode);
            }
        }

        childDocs.push(printChild(idx));
    }
}

/**
 * Split the text into words separated by whitespace. Replace the whitespaces by lines,
 * collapsing multiple whitespaces into a single line.
 *
 * If the text starts or ends with multiple newlines, two of those should be kept.
 */
function splitTextToDocs(node: Text): Doc[] {
    const text = getUnencodedText(node);
    const lines = text.split(/[\t\n\f\r ]+/);

    let docs = join(line, lines).filter((doc) => doc !== '');

    if (startsWithLinebreak(text)) {
        docs[0] = hardline;
    }
    if (startsWithLinebreak(text, 2)) {
        docs = [hardline, ...docs];
    }

    if (endsWithLinebreak(text)) {
        docs[docs.length - 1] = hardline;
    }
    if (endsWithLinebreak(text, 2)) {
        docs = [...docs, hardline];
    }

    return docs;
}

function printJS(path: AstPath, print: PrintFn, name: string) {
    return path.call(print, name);
}

function expandNode(node: any, original: string): string {
    let str = _expandNode(node);
    if (node?.typeAnnotation) {
        str += ': ' + original.slice(node.typeAnnotation.start, node.typeAnnotation.end);
    }
    return str;
}

function _expandNode(node: any, parent?: any): string {
    if (node === null) {
        return '';
    }

    if (typeof node === 'string') {
        // pre-v3.20 AST
        return ' ' + node;
    }

    switch (node.type) {
        case 'ArrayExpression':
        case 'ArrayPattern':
            return ' [' + node.elements.map(_expandNode).join(',').slice(1) + ']';
        case 'AssignmentPattern':
            return _expandNode(node.left) + ' =' + _expandNode(node.right);
        case 'Identifier':
            return ' ' + node.name;
        case 'Literal':
            return ' ' + node.raw;
        case 'ObjectExpression':
            return ' {' + node.properties.map((p: any) => _expandNode(p, node)).join(',') + ' }';
        case 'ObjectPattern':
            return ' {' + node.properties.map(_expandNode).join(',') + ' }';
        case 'Property':
            if (node.value.type === 'ObjectPattern' || node.value.type === 'ArrayPattern') {
                return ' ' + node.key.name + ':' + _expandNode(node.value);
            } else if (
                (node.value.type === 'Identifier' && node.key.name !== node.value.name) ||
                (parent && parent.type === 'ObjectExpression')
            ) {
                return _expandNode(node.key) + ':' + _expandNode(node.value);
            } else {
                return _expandNode(node.value);
            }
        case 'RestElement':
            return ' ...' + node.argument.name;
    }

    console.error(JSON.stringify(node, null, 4));
    throw new Error('unknown node type: ' + node.type);
}
