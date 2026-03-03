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
    checkWhitespaceAtEndOfSvelteBlock,
    checkWhitespaceAtStartOfSvelteBlock,
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
    isLoneMustacheTag,
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
import {
    ASTNode,
    AttributeNode,
    CommentNode,
    Node,
    OptionsNode,
    StyleDirectiveNode,
    TextNode,
} from './nodes';
import { AST } from 'svelte/compiler';

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
let svelteOptionsDoc: Doc | undefined;

export function print(path: AstPath, options: ParserOptions, print: PrintFn): Doc {
    const bracketSameLine = isBracketSameLine(options);

    const n = path.node;
    if (!n) {
        return '';
    }

    if (isASTNode(n)) {
        return printTopLevelParts(n, options, path, print);
    }

    const [open, close] = ['{', '}'];
    const printJsExpression = () => [open, printJS(path, print, 'expression'), close];
    const node = n as Node;

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
                trimChildren(children, path);
                const output = trim(
                    [printChildren(path, print, options)],
                    (n) =>
                        isLine(n) ||
                        (typeof n === 'string' && n.trim() === '') ||
                        // Because printChildren may append this at the end and
                        // may hide other lines before it
                        n === breakParent,
                );
                if (output.every((doc) => isEmptyDoc(doc))) {
                    return '';
                }
                return group([...output, hardline]);
            } else {
                return group(path.map(print, 'nodes'));
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
                        // Shrink trailing whitespace in case it's followed by a mustache tag
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
        case 'Component':
        case 'SvelteComponent':
        case 'SvelteSelf':
        case 'SlotElement':
        case 'SvelteFragment':
        case 'SvelteWindow':
        case 'SvelteHead':
        case 'SvelteBody':
        case 'SvelteDocument':
        case 'SvelteElement':
        // Svelte 5 only
        case 'SvelteBoundary':
        case 'TitleElement': {
            const isSupportedLanguage = !(
                node.name === 'template' && !isNodeSupportedLanguage(node)
            );
            const element_children = getChildren(node);
            const isEmpty = element_children.every((child) => isEmptyTextNode(child));
            const isDoctypeTag = node.name.toUpperCase() === '!DOCTYPE';
            const didSelfClose = options.originalText[node.end - 2] === '/';

            const isSelfClosingTag =
                isEmpty &&
                (((node.type === 'RegularElement' ||
                    node.type === 'SvelteHead' ||
                    node.type === 'Component' ||
                    node.type === 'SvelteComponent' ||
                    node.type === 'SvelteSelf' ||
                    node.type === 'SlotElement' ||
                    node.type === 'SvelteFragment' ||
                    node.type === 'SvelteBoundary' ||
                    node.type === 'TitleElement' ||
                    node.type === 'SvelteBody' ||
                    node.type === 'SvelteDocument' ||
                    node.type === 'SvelteElement') &&
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
                node.type === 'SvelteComponent' && node.expression
                    ? [attributeLine, 'this=', ...printJsExpression()]
                    : node.type === 'SvelteElement' && node.tag
                    ? [
                          attributeLine,
                          'this=',
                          ...(() => {
                              if (typeof node.tag === 'string') {
                                  return [`"${node.tag}"`];
                              }

                              if (
                                  node.tag?.type === 'Literal' &&
                                  typeof (node.tag as any).value === 'string'
                              ) {
                                  const literal_value = (node.tag as any).value;
                                  const tag_start = (node.tag as any).start;
                                  const expression_wrapped =
                                      typeof tag_start === 'number' &&
                                      options.originalText[tag_start - 1] === '{';
                                  if (expression_wrapped) {
                                      return [open, `"${literal_value}"`, close];
                                  }
                                  return [`"${literal_value}"`];
                              }

                              return [open, printJS(path, print, 'tag'), close];
                          })(),
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

            const children = element_children;
            const firstChild = children[0];
            const lastChild = children[children.length - 1];

            // Is a function which is invoked later because printChildren will manipulate child nodes
            // which would wrongfully change the other checks about hugging etc done beforehand
            let body: () => Doc;

            const hugStart = shouldHugStart(node, isSupportedLanguage, options);
            const hugEnd = shouldHugEnd(node, isSupportedLanguage, options);

            if (isEmpty) {
                body =
                    isInlineElement(path, options, node) &&
                    children.length &&
                    isTextNodeStartingWithWhitespace(children[0]) &&
                    !isPreTagContent(path)
                        ? () => line
                        : () => (bracketSameLine ? softline : '');
            } else if (isPreTagContent(path)) {
                body = () =>
                    path.call(
                        (fragment_path) => printPre(options.originalText, fragment_path, print),
                        'fragment',
                    );
            } else if (!isSupportedLanguage) {
                body = () => printRaw(node, options.originalText, true);
            } else if (isInlineElement(path, options, node) && !isPreTagContent(path)) {
                body = () =>
                    path.call(
                        (fragment_path) => printChildren(fragment_path, print, options),
                        'fragment',
                    );
            } else {
                body = () =>
                    path.call(
                        (fragment_path) => printChildren(fragment_path, print, options),
                        'fragment',
                    );
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
        case 'Options':
            if (options.svelteSortOrder !== 'none') {
                throw new Error('Options tags should have been handled by prepareChildren');
            }
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
        case 'Literal':
            return JSON.stringify(node.value);
        case 'ConditionalExpression':
            return group([
                printJS(path, print, 'test'),
                indent([
                    line,
                    '? ',
                    printJS(path, print, 'consequent'),
                    line,
                    ': ',
                    printJS(path, print, 'alternate'),
                ]),
            ]);
        case 'VariableDeclarator':
            return [printJS(path, print, 'id'), ' = ', printJS(path, print, 'init')];
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

                const quotes = !isLoneMustacheTag(node.value);
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
            const def: Doc[] = [
                '{#if ',
                printJS(path, print, 'test'),
                '}',
                printBlockFragment(path, print, options, 'consequent'),
            ];

            if (node.alternate) {
                def.push(printIfBlockAlternate(path, print, options));
            }

            def.push('{/if}');

            return group([def, breakParent]);
        }
        case 'EachBlock': {
            const def: Doc[] = ['{#each ', printJS(path, print, 'expression')];

            if (node.context) {
                def.push(' as', expandNode(node.context, options.originalText));
            }

            if (node.index) {
                def.push(', ', node.index);
            }

            if (node.key) {
                def.push(' (', printJS(path, print, 'key'), ')');
            }

            def.push('}', printBlockFragment(path, print, options, 'body'));

            if (node.fallback) {
                def.push(printEachBlockFallback(path, print, options));
            }

            def.push('{/each}');

            return group([def, breakParent]);
        }
        case 'AwaitBlock': {
            const pending_children = node.pending?.nodes ?? [];
            const then_children = node.then?.nodes ?? [];
            const catch_children = node.catch?.nodes ?? [];
            const hasPendingBlock = pending_children.some((n) => !isEmptyTextNode(n as any));
            const hasThenBlock = then_children.some((n) => !isEmptyTextNode(n as any));
            const hasCatchBlock = catch_children.some((n) => !isEmptyTextNode(n as any));

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
                    printBlockFragment(path, print, options, 'then'),
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
                    printBlockFragment(path, print, options, 'catch'),
                );
            } else {
                block.push(group(['{#await ', printJS(path, print, 'expression'), '}']));

                if (hasPendingBlock) {
                    block.push(printBlockFragment(path, print, options, 'pending'));
                }

                if (hasThenBlock) {
                    block.push(
                        group(['{:then', expandNode(node.value, options.originalText), '}']),
                        printBlockFragment(path, print, options, 'then'),
                    );
                }
            }

            if ((hasPendingBlock || hasThenBlock) && hasCatchBlock) {
                block.push(
                    group(['{:catch', expandNode(node.error, options.originalText), '}']),
                    printBlockFragment(path, print, options, 'catch'),
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
                printBlockFragment(path, print, options, 'fragment'),
            ];

            def.push('{/key}');

            return group([def, breakParent]);
        }
        case 'SnippetBlock': {
            const snippet = ['{#snippet ', printJS(path, print, 'expression')];
            snippet.push('}', printBlockFragment(path, print, options, 'body'), '{/snippet}');
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
                const quotes = !isLoneMustacheTag(node.value);
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

            return printComment(node);
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
        // Svelte 5 only
        case 'RenderTag':
            return ['{@render ', printJS(path, print, 'expression'), '}'];
        // Svelte 5 only
        case 'AttachTag':
            return ['{@attach ', printJS(path, print, 'expression'), '}'];
        case 'SpreadAttribute':
            return ['{...', printJS(path, print, 'expression'), '}'];
        case 'ConstTag':
            return ['{@const ', printJS(path, print, 'expression'), '}'];
    }

    console.error(JSON.stringify(node, null, 4));
    throw new Error('unknown node type: ' + node.type);
}

function printTopLevelParts(
    n: ASTNode,
    options: ParserOptions,
    path: AstPath<any>,
    print: PrintFn,
): Doc {
    if (n.options) {
        const nodes = n.fragment.nodes as Node[];
        const has_options_node = nodes.some((node: any) => node.type === 'Options');
        if (!has_options_node) {
            nodes.push({
                type: 'Options',
                name: 'svelte:options',
                start: n.options.start,
                end: n.options.end,
                attributes: n.options.attributes,
            } as any);
            nodes.sort((a: any, b: any) => a.start - b.start);
        }
    }

    if (options.svelteSortOrder === 'none') {
        const topLevelPartsByEnd: Record<number, any> = {};
        const topLevelPartsByStart: Record<number, any> = {};

        if (n.module) {
            topLevelPartsByEnd[n.module.end] = n.module;
            topLevelPartsByStart[n.module.start] = n.module;
        }
        if (n.instance) {
            topLevelPartsByEnd[n.instance.end] = n.instance;
            topLevelPartsByStart[n.instance.start] = n.instance;
        }
        if (n.css) {
            topLevelPartsByEnd[n.css.end] = n.css;
            topLevelPartsByStart[n.css.start] = n.css;
        }

        const children = n.fragment.nodes as Node[];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (topLevelPartsByEnd[node.start]) {
                children.splice(i, 0, topLevelPartsByEnd[node.start]);
                delete topLevelPartsByEnd[node.start];
            } else if (i === children.length - 1 && topLevelPartsByStart[node.end]) {
                children.push(topLevelPartsByStart[node.end]);
            }
        }

        const result = path.call(print, 'fragment');
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

    // scripts
    if (n.module) {
        parts.scripts.push(path.call(print, 'module'));
    }
    if (n.instance) {
        parts.scripts.push(path.call(print, 'instance'));
    }

    // styles
    if (n.css) {
        parts.styles.push(path.call(print, 'css'));
    }

    // markup
    const htmlDoc = path.call(print, 'fragment');
    if (htmlDoc) {
        parts.markup.push(htmlDoc);
    }
    if (svelteOptionsDoc) {
        parts.options.push(svelteOptionsDoc);
    }

    const docs = flatten(parseSortOrder(options.svelteSortOrder).map((p) => parts[p]));

    // Need to reset these because they are global and could affect the next formatting run
    ignoreNext = false;
    ignoreRange = false;
    svelteOptionsDoc = undefined;

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
    const valueDocs = Array.isArray((node as any).value)
        ? path.map((childPath) => childPath.call(print), 'value')
        : [path.call(print, 'value')];

    if (!quotes || !formattableAttributes.includes(node.name)) {
        return valueDocs;
    } else {
        return indent(group(trim(valueDocs, isLine)));
    }
}

function printSvelteBlockChildren(path: AstPath, print: PrintFn, options: ParserOptions): Doc {
    const fragment = path.node as AST.Fragment;
    const children = fragment?.nodes ?? [];
    if (children.length === 0) {
        return '';
    }

    const whitespaceAtStartOfBlock = checkWhitespaceAtStartOfSvelteBlock(fragment, options);
    const whitespaceAtEndOfBlock = checkWhitespaceAtEndOfSvelteBlock(fragment, options);
    const startline =
        whitespaceAtStartOfBlock === 'none'
            ? ''
            : whitespaceAtEndOfBlock === 'line' || whitespaceAtStartOfBlock === 'line'
            ? hardline
            : line;
    const endline =
        whitespaceAtEndOfBlock === 'none'
            ? ''
            : whitespaceAtEndOfBlock === 'line' || whitespaceAtStartOfBlock === 'line'
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

    return [indent([startline, group(printChildren(path, print, options))]), endline];
}

function printBlockFragment(
    path: AstPath,
    print: PrintFn,
    options: ParserOptions,
    to: string,
): Doc {
    return path.call(
        (fragment_path) => printSvelteBlockChildren(fragment_path, print, options),
        to,
    );
}

function printIfBlockAlternate(path: AstPath, print: PrintFn, options: ParserOptions): Doc {
    const node = path.node as any;
    const alternate = node.alternate;

    if (!alternate) {
        return '';
    }

    if (alternate.type === 'Fragment') {
        if (alternate.nodes.length === 1 && alternate.nodes[0].type === 'IfBlock') {
            const def: Doc[] = [
                '{:else if ',
                path.call((if_path) => printJS(if_path, print, 'test'), 'alternate', 'nodes', 0),
                '}',
                path.call(
                    (if_path) => printBlockFragment(if_path, print, options, 'consequent'),
                    'alternate',
                    'nodes',
                    0,
                ),
            ];

            if (alternate.nodes[0].alternate) {
                def.push(
                    path.call(
                        (if_path) => printIfBlockAlternate(if_path, print, options),
                        'alternate',
                        'nodes',
                        0,
                    ),
                );
            }

            return def;
        }

        return ['{:else}', printBlockFragment(path, print, options, 'alternate')];
    }

    return ['{:else}', printBlockFragment(path, print, options, 'alternate')];
}

function printEachBlockFallback(path: AstPath, print: PrintFn, options: ParserOptions): Doc {
    const node = path.node as any;
    const fallback = node.fallback;
    if (!fallback) {
        return '';
    }
    return ['{:else}', printBlockFragment(path, print, options, 'fallback')];
}

function printPre(originalText: string, path: AstPath, print: PrintFn): Doc {
    const result: Doc = [];
    const fragment = path.node as { nodes?: Node[] };
    const children = fragment?.nodes ?? [];
    if (children.length === 0) {
        return '';
    }

    const length = children.length;
    for (let i = 0; i < length; i++) {
        const child = children[i];
        if (child.type === 'Text') {
            const lines = originalText.substring(child.start, child.end).split(/\r?\n/);
            lines.forEach((line, j) => {
                if (j > 0) result.push(literalline);
                result.push(line);
            });
        } else {
            result.push(path.call(print, 'nodes', i));
        }
    }
    return result;
}

function printChildren(path: AstPath, print: PrintFn, options: ParserOptions): Doc {
    const current_value = path.node as { nodes?: Node[] };

    if (isPreTagContent(path)) {
        return path.map(print, 'nodes');
    }

    const original_children = current_value.nodes ?? [];
    const prepared_children = prepareChildren(original_children, path, print, options);
    if (prepared_children.length === 0) {
        return '';
    }

    const childDocs: Doc[] = [];
    let handleWhitespaceOfPrevTextNode = false;

    for (let i = 0; i < prepared_children.length; i++) {
        const childNode = prepared_children[i].node;
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
        prepared_children.length > 1 &&
        prepared_children.some((child) => isBlockElement(child.node, options));
    if (forceBreakContent) {
        childDocs.push(breakParent);
    }

    return childDocs;

    function printChild(idx: number): Doc {
        return path.call(print, 'nodes', prepared_children[idx].index);
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
        const prevChild = prepared_children[idx - 1]?.node;
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

        const nextChild = prepared_children[idx + 1]?.node;
        if (
            nextChild &&
            (nextChild.type !== 'Text' ||
                // Only handle text which starts with a whitespace and has text afterwards,
                // or is empty but followed by an inline element. The latter is done
                // so that if the children break, the inline element afterwards is in a separate line.
                ((!isEmptyTextNode(nextChild) ||
                    (prepared_children[idx + 2] &&
                        isInlineElement(path, options, prepared_children[idx + 2].node))) &&
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
    function handleTextChild(idx: number, childNode: TextNode) {
        handleWhitespaceOfPrevTextNode = false;

        if (idx === 0 || idx === prepared_children.length - 1) {
            childDocs.push(printChild(idx));
            return;
        }

        const prevNode = prepared_children[idx - 1].node;
        const nextNode = prepared_children[idx + 1].node;

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

interface PreparedChild {
    node: Node;
    index: number;
}

/**
 * `svelte:options` is part of the html part but needs to be snipped out and handled
 * separately to reorder it as configured. The comment above it should be moved with it.
 * Do that here.
 */
function prepareChildren(
    children: Node[],
    path: AstPath,
    print: PrintFn,
    options: ParserOptions,
): PreparedChild[] {
    let svelteOptionsComment: Doc | undefined;
    const childrenWithoutOptions: PreparedChild[] = [];
    const bracketSameLine = isBracketSameLine(options);

    for (let idx = 0; idx < children.length; idx++) {
        const currentChild = children[idx];

        if (currentChild.type === 'Text' && getUnencodedText(currentChild) === '') {
            continue;
        }

        if (isEmptyTextNode(currentChild) && doesEmbedStartAfterNode(currentChild, path)) {
            continue;
        }

        if (options.svelteSortOrder !== 'none') {
            if (isCommentFollowedByOptions(currentChild, idx)) {
                svelteOptionsComment = printComment(currentChild);
                const nextChild = children[idx + 1];
                idx += nextChild && isEmptyTextNode(nextChild) ? 1 : 0;
                continue;
            }

            if (currentChild.type === 'Options') {
                printSvelteOptions(currentChild, idx, path, print);
                continue;
            }
        }

        childrenWithoutOptions.push({ node: currentChild, index: idx });
    }

    const mergedChildrenWithoutOptions: PreparedChild[] = [];

    for (let idx = 0; idx < childrenWithoutOptions.length; idx++) {
        const currentChild = childrenWithoutOptions[idx];
        const nextChild = childrenWithoutOptions[idx + 1];

        if (currentChild.node.type === 'Text' && nextChild && nextChild.node.type === 'Text') {
            // A tag was snipped out (f.e. svelte:options). Join text
            currentChild.node.raw += nextChild.node.raw;
            currentChild.node.data += nextChild.node.data;
            idx++;
        }

        mergedChildrenWithoutOptions.push(currentChild);
    }

    return mergedChildrenWithoutOptions;

    function printSvelteOptions(
        node: OptionsNode,
        idx: number,
        path: AstPath,
        print: PrintFn,
    ): void {
        svelteOptionsDoc = group([
            [
                '<',
                node.name,
                indent(
                    group([
                        ...path.map(
                            printWithPrependedAttributeLine(node, options, print),
                            'nodes',
                            idx,
                            'attributes',
                        ),
                        bracketSameLine ? '' : dedent(line),
                    ]),
                ),
                ...[bracketSameLine ? ' ' : '', '/>'],
            ],
            hardline,
        ]);
        if (svelteOptionsComment) {
            svelteOptionsDoc = group([svelteOptionsComment, hardline, svelteOptionsDoc]);
        }
    }

    function isCommentFollowedByOptions(node: Node, idx: number): node is CommentNode {
        if (node.type !== 'Comment' || isIgnoreEndDirective(node) || isIgnoreStartDirective(node)) {
            return false;
        }

        const nextChild = children[idx + 1];
        if (nextChild) {
            if (isEmptyTextNode(nextChild)) {
                const afterNext = children[idx + 2];
                return afterNext && afterNext.type === 'Options';
            }
            return nextChild.type === 'Options';
        }

        return false;
    }
}

/**
 * Split the text into words separated by whitespace. Replace the whitespaces by lines,
 * collapsing multiple whitespaces into a single line.
 *
 * If the text starts or ends with multiple newlines, two of those should be kept.
 */
function splitTextToDocs(node: TextNode): Doc[] {
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
        str +=
            ': ' +
            original.slice(
                node.typeAnnotation.typeAnnotation.start,
                node.typeAnnotation.typeAnnotation.end,
            );
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
            return (
                ' [' +
                node.elements
                    // handle null specifically here; else it would become the empty string, but that would mean
                    // fewer elements in the array, which would change the meaning of the array
                    .map((el: any) => (el === null ? ' ' : _expandNode(el)))
                    .join(',')
                    .slice(1) +
                ']'
            );
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

function printComment(node: CommentNode) {
    let text = node.data;

    if (hasSnippedContent(text)) {
        text = unsnipContent(text);
    }

    return group(['<!--', text, '-->']);
}
