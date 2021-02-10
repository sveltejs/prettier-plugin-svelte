import { Doc, doc, FastPath, ParserOptions } from 'prettier';
import { formattableAttributes, selfClosingTags } from '../lib/elements';
import { extractAttributes } from '../lib/extractAttributes';
import { getText } from '../lib/getText';
import { hasSnippedContent, unsnipContent } from '../lib/snipTagContent';
import { parseSortOrder, SortOrderPart } from '../options';
import { isEmptyDoc, isLine, trim, trimRight } from './doc-helpers';
import { flatten, isASTNode, isPreTagContent } from './helpers';
import {
    checkWhitespaceAtEndOfSvelteBlock,
    checkWhitespaceAtStartOfSvelteBlock,
    doesEmbedStartAfterNode,
    endsWithLinebreak,
    getUnencodedText,
    isBlockElement,
    isEmptyTextNode,
    isIgnoreDirective,
    isInlineElement,
    isInsideQuotedAttribute,
    isLoneMustacheTag,
    isNodeSupportedLanguage,
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
    canOmitSoftlineBeforeClosingTag,
    getNextNode,
} from './node-helpers';
import {
    ASTNode,
    AttributeNode,
    CommentNode,
    IfBlockNode,
    Node,
    OptionsNode,
    TextNode,
} from './nodes';

const {
    concat,
    join,
    line,
    group,
    indent,
    dedent,
    softline,
    hardline,
    fill,
    breakParent,
    literalline,
} = doc.builders;

export type PrintFn = (path: FastPath) => Doc;

declare module 'prettier' {
    export namespace doc {
        namespace builders {
            interface Line {
                keepIfLonely?: boolean;
            }
        }
    }
}

let ignoreNext = false;
let svelteOptionsDoc: Doc | undefined;

function groupConcat(contents: doc.builders.Doc[]): doc.builders.Doc {
    return group(concat(contents));
}

export function print(path: FastPath, options: ParserOptions, print: PrintFn): Doc {
    const n = path.getValue();
    if (!n) {
        return '';
    }

    if (isASTNode(n)) {
        return printTopLevelParts(n, options, path, print);
    }

    const [open, close] = options.svelteStrictMode ? ['"{', '}"'] : ['{', '}'];
    const printJsExpression = () => [
        open,
        printJS(path, print, options.svelteStrictMode, false, 'expression'),
        close,
    ];
    const node = n as Node;

    if (ignoreNext && (node.type !== 'Text' || !isEmptyTextNode(node))) {
        ignoreNext = false;
        return concat(
            flatten(
                options.originalText
                    .slice(options.locStart(node), options.locEnd(node))
                    .split('\n')
                    .map((o, i) => (i == 0 ? [o] : [literalline, o])),
            ),
        );
    }

    switch (node.type) {
        case 'Fragment':
            const children = node.children;

            if (children.length === 0 || children.every(isEmptyTextNode)) {
                return '';
            }
            if (!isPreTagContent(path)) {
                trimChildren(node.children, path);
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
                return groupConcat([...output, hardline]);
            } else {
                return groupConcat(path.map(print, 'children'));
            }
        case 'Text':
            if (!isPreTagContent(path)) {
                if (isEmptyTextNode(node)) {
                    const hasWhiteSpace =
                        getUnencodedText(node).trim().length < getUnencodedText(node).length;
                    const hasOneOrMoreNewlines = /\n/.test(getUnencodedText(node));
                    const hasTwoOrMoreNewlines = /\n\r?\s*\n\r?/.test(getUnencodedText(node));
                    if (hasTwoOrMoreNewlines) {
                        return concat([hardline, hardline]);
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
                return getUnencodedText(node);
            }
        case 'Element':
        case 'InlineComponent':
        case 'Slot':
        case 'Window':
        case 'Head':
        case 'Title': {
            const isSupportedLanguage = !(
                node.name === 'template' && !isNodeSupportedLanguage(node)
            );
            const isEmpty = node.children.every((child) => isEmptyTextNode(child));

            const isSelfClosingTag =
                isEmpty &&
                (!options.svelteStrictMode ||
                    node.type !== 'Element' ||
                    selfClosingTags.indexOf(node.name) !== -1);

            // Order important: print attributes first
            const attributes = path.map((childPath) => childPath.call(print), 'attributes');
            const possibleThisBinding =
                node.type === 'InlineComponent' && node.expression
                    ? concat([line, 'this=', ...printJsExpression()])
                    : '';

            if (isSelfClosingTag) {
                return groupConcat([
                    '<',
                    node.name,

                    indent(
                        groupConcat([
                            possibleThisBinding,
                            ...attributes,
                            options.svelteBracketNewLine ? dedent(line) : '',
                        ]),
                    ),

                    ...[options.svelteBracketNewLine ? '' : ' ', `/>`],
                ]);
            }

            const children = node.children;
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
                    node.children.length &&
                    isTextNodeStartingWithWhitespace(node.children[0]) &&
                    !isPreTagContent(path)
                        ? () => line
                        : () => (options.svelteBracketNewLine ? '' : softline);
            } else if (isPreTagContent(path)) {
                body = () => printRaw(node, options.originalText);
            } else if (!isSupportedLanguage) {
                body = () => printRaw(node, options.originalText, true);
            } else if (isInlineElement(path, options, node) && !isPreTagContent(path)) {
                body = () => printChildren(path, print, options);
            } else {
                body = () => printChildren(path, print, options);
            }

            const openingTag = [
                '<',
                node.name,

                indent(
                    groupConcat([
                        possibleThisBinding,
                        ...attributes,
                        hugStart
                            ? ''
                            : options.svelteBracketNewLine && !isPreTagContent(path)
                            ? dedent(softline)
                            : '',
                    ]),
                ),
            ];

            if (!isSupportedLanguage && !isEmpty) {
                // Format template tags so that there's a hardline but no intendation.
                // That way the `lang="X"` and the closing `>` of the start tag stay in one line
                // which is the 99% use case.
                return groupConcat([
                    ...openingTag,
                    '>',
                    groupConcat([hardline, body(), hardline]),
                    `</${node.name}>`,
                ]);
            }

            if (hugStart && hugEnd) {
                const huggedContent = concat([
                    softline,
                    groupConcat(['>', body(), `</${node.name}`]),
                ]);
                const omitSoftlineBeforeClosingTag =
                    (isEmpty && options.svelteBracketNewLine) ||
                    canOmitSoftlineBeforeClosingTag(node, path, options);
                return groupConcat([
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
                return groupConcat([
                    ...openingTag,
                    indent(concat([softline, groupConcat(['>', body()])])),
                    noHugSeparatorEnd,
                    `</${node.name}>`,
                ]);
            }

            if (hugEnd) {
                return groupConcat([
                    ...openingTag,
                    '>',
                    indent(concat([noHugSeparatorStart, groupConcat([body(), `</${node.name}`])])),
                    canOmitSoftlineBeforeClosingTag(node, path, options) ? '' : softline,
                    '>',
                ]);
            }

            if (isEmpty) {
                return groupConcat([...openingTag, '>', body(), `</${node.name}>`]);
            }

            return groupConcat([
                ...openingTag,
                '>',
                indent(concat([noHugSeparatorStart, body()])),
                noHugSeparatorEnd,
                `</${node.name}>`,
            ]);
        }
        case 'Options':
            throw new Error('Options tags should have been handled by prepareChildren');
        case 'Body':
            return groupConcat([
                '<',
                node.name,

                indent(groupConcat(path.map((childPath) => childPath.call(print), 'attributes'))),

                ' />',
            ]);
        case 'Identifier':
            return node.name;
        case 'AttributeShorthand': {
            return (node.expression as any).name;
        }
        case 'Attribute': {
            if (isOrCanBeConvertedToShorthand(node)) {
                if (options.svelteStrictMode) {
                    return concat([line, node.name, '="{', node.name, '}"']);
                } else if (options.svelteAllowShorthand) {
                    return concat([line, '{', node.name, '}']);
                } else {
                    return concat([line, node.name, '={', node.name, '}']);
                }
            } else {
                if (node.value === true) {
                    return concat([line, node.name]);
                }

                const quotes = !isLoneMustacheTag(node.value) || options.svelteStrictMode;
                const attrNodeValue = printAttributeNodeValue(path, print, quotes, node);
                if (quotes) {
                    return concat([line, node.name, '=', '"', attrNodeValue, '"']);
                } else {
                    return concat([line, node.name, '=', attrNodeValue]);
                }
            }
        }
        case 'MustacheTag':
            return concat([
                '{',
                printJS(path, print, isInsideQuotedAttribute(path, options), false, 'expression'),
                '}',
            ]);
        case 'IfBlock': {
            const def: Doc[] = [
                '{#if ',
                printSvelteBlockJS(path, print, 'expression'),
                '}',
                printSvelteBlockChildren(path, print, options),
            ];

            if (node.else) {
                def.push(path.call(print, 'else'));
            }

            def.push('{/if}');

            return concat([groupConcat(def), breakParent]);
        }
        case 'ElseBlock': {
            // Else if
            const parent = path.getParentNode() as Node;

            if (
                node.children.length === 1 &&
                node.children[0].type === 'IfBlock' &&
                parent.type !== 'EachBlock'
            ) {
                const ifNode = node.children[0] as IfBlockNode;
                const def: Doc[] = [
                    '{:else if ',
                    path.map(
                        (ifPath) => printSvelteBlockJS(ifPath, print, 'expression'),
                        'children',
                    )[0],
                    '}',
                    path.map(
                        (ifPath) => printSvelteBlockChildren(ifPath, print, options),
                        'children',
                    )[0],
                ];

                if (ifNode.else) {
                    def.push(path.map((ifPath) => ifPath.call(print, 'else'), 'children')[0]);
                }
                return concat(def);
            }

            return concat(['{:else}', printSvelteBlockChildren(path, print, options)]);
        }
        case 'EachBlock': {
            const def: Doc[] = [
                '{#each ',
                printSvelteBlockJS(path, print, 'expression'),
                ' as ',
                printSvelteBlockJS(path, print, 'context'),
            ];

            if (node.index) {
                def.push(', ', node.index);
            }

            if (node.key) {
                def.push(' (', printSvelteBlockJS(path, print, 'key'), ')');
            }

            def.push('}', printSvelteBlockChildren(path, print, options));

            if (node.else) {
                def.push(path.call(print, 'else'));
            }

            def.push('{/each}');

            return concat([groupConcat(def), breakParent]);
        }
        case 'AwaitBlock': {
            const hasPendingBlock = node.pending.children.some((n) => !isEmptyTextNode(n));
            const hasThenBlock = node.then.children.some((n) => !isEmptyTextNode(n));
            const hasCatchBlock = node.catch.children.some((n) => !isEmptyTextNode(n));

            let block = [];

            if (!hasPendingBlock && hasThenBlock) {
                block.push(
                    groupConcat([
                        '{#await ',
                        printSvelteBlockJS(path, print, 'expression'),
                        ' then',
                        expandNode(node.value),
                        '}',
                    ]),
                    path.call(print, 'then'),
                );
            } else {
                block.push(
                    groupConcat(['{#await ', printSvelteBlockJS(path, print, 'expression'), '}']),
                );

                if (hasPendingBlock) {
                    block.push(path.call(print, 'pending'));
                }

                if (hasThenBlock) {
                    block.push(
                        groupConcat(['{:then', expandNode(node.value), '}']),
                        path.call(print, 'then'),
                    );
                }
            }

            if (hasCatchBlock) {
                block.push(
                    groupConcat(['{:catch', expandNode(node.error), '}']),
                    path.call(print, 'catch'),
                );
            }

            block.push('{/await}');

            return groupConcat(block);
        }
        case 'KeyBlock': {
            const def: Doc[] = [
                '{#key ',
                printSvelteBlockJS(path, print, 'expression'),
                '}',
                printSvelteBlockChildren(path, print, options),
            ];

            def.push('{/key}');

            return concat([groupConcat(def), breakParent]);
        }
        case 'ThenBlock':
        case 'PendingBlock':
        case 'CatchBlock':
            return printSvelteBlockChildren(path, print, options);
        case 'EventHandler':
            return concat([
                line,
                'on:',
                node.name,
                node.modifiers && node.modifiers.length
                    ? concat(['|', join('|', node.modifiers)])
                    : '',
                node.expression ? concat(['=', ...printJsExpression()]) : '',
            ]);
        case 'Binding':
            return concat([
                line,
                'bind:',
                node.name,
                node.expression.type === 'Identifier' && node.expression.name === node.name
                    ? ''
                    : concat(['=', ...printJsExpression()]),
            ]);
        case 'Class':
            return concat([
                line,
                'class:',
                node.name,
                node.expression.type === 'Identifier' && node.expression.name === node.name
                    ? ''
                    : concat(['=', ...printJsExpression()]),
            ]);
        case 'Let':
            return concat([
                line,
                'let:',
                node.name,
                // shorthand let directives have `null` expressions
                !node.expression ||
                (node.expression.type === 'Identifier' && node.expression.name === node.name)
                    ? ''
                    : concat(['=', ...printJsExpression()]),
            ]);
        case 'DebugTag':
            return concat([
                '{@debug',
                node.identifiers.length > 0
                    ? concat([' ', join(', ', path.map(print, 'identifiers'))])
                    : '',
                '}',
            ]);
        case 'Ref':
            return concat([line, 'ref:', node.name]);
        case 'Comment': {
            const nodeAfterComment = getNextNode(path);

            /**
             * If there is no sibling node that starts right after us but the parent indicates
             * that there used to be, that means that node was actually an embedded `<style>`
             * or `<script>` node that was cut out.
             * If so, the comment does not refer to the next line we will see.
             * The `embed` function handles printing the comment in the right place.
             */
            if (
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
        case 'Transition':
            const kind = node.intro && node.outro ? 'transition' : node.intro ? 'in' : 'out';
            return concat([
                line,
                kind,
                ':',
                node.name,
                node.modifiers && node.modifiers.length
                    ? concat(['|', join('|', node.modifiers)])
                    : '',
                node.expression ? concat(['=', ...printJsExpression()]) : '',
            ]);
        case 'Action':
            return concat([
                line,
                'use:',
                node.name,
                node.expression ? concat(['=', ...printJsExpression()]) : '',
            ]);
        case 'Animation':
            return concat([
                line,
                'animate:',
                node.name,
                node.expression ? concat(['=', ...printJsExpression()]) : '',
            ]);
        case 'RawMustacheTag':
            return concat(['{@html ', printJS(path, print, false, false, 'expression'), '}']);
        case 'Spread':
            return concat([line, '{...', printJS(path, print, false, false, 'expression'), '}']);
    }

    console.error(JSON.stringify(node, null, 4));
    throw new Error('unknown node type: ' + node.type);
}

function printTopLevelParts(
    n: ASTNode,
    options: ParserOptions,
    path: FastPath<any>,
    print: PrintFn,
): Doc {
    const parts: Record<SortOrderPart, Doc[]> = {
        options: [],
        scripts: [],
        markup: [],
        styles: [],
    };

    // scripts
    if (n.module) {
        n.module.type = 'Script';
        n.module.attributes = extractAttributes(getText(n.module, options));
        parts.scripts.push(path.call(print, 'module'));
    }
    if (n.instance) {
        n.instance.type = 'Script';
        n.instance.attributes = extractAttributes(getText(n.instance, options));
        parts.scripts.push(path.call(print, 'instance'));
    }

    // styles
    if (n.css) {
        n.css.type = 'Style';
        n.css.content.type = 'StyleProgram';
        parts.styles.push(path.call(print, 'css'));
    }

    // markup
    const htmlDoc = path.call(print, 'html');
    if (htmlDoc) {
        parts.markup.push(htmlDoc);
    }
    if (svelteOptionsDoc) {
        parts.options.push(svelteOptionsDoc);
    }

    const docs = flatten(parseSortOrder(options.svelteSortOrder).map((p) => parts[p]));

    // Need to reset these because they are global and could affect the next formatting run
    ignoreNext = false;
    svelteOptionsDoc = undefined;

    // If this is invoked as an embed of markdown, remove the last hardline.
    // The markdown parser tries this, too, but fails because it does not
    // recurse into concats. Doing this will prevent an empty line
    // at the end of the embedded code block.
    if (options.parentParser === 'markdown') {
        const lastDoc = docs[docs.length - 1];
        trimRight([lastDoc], isLine);
    }

    return groupConcat([join(hardline, docs)]);
}

function printAttributeNodeValue(
    path: FastPath<any>,
    print: PrintFn,
    quotes: boolean,
    node: AttributeNode,
) {
    const valueDocs = path.map((childPath) => childPath.call(print), 'value');

    if (!quotes || !formattableAttributes.includes(node.name)) {
        return concat(valueDocs);
    } else {
        return indent(groupConcat(trim(valueDocs, isLine)));
    }
}

function printSvelteBlockChildren(path: FastPath, print: PrintFn, options: ParserOptions): Doc {
    const node = path.getValue();
    const children = node.children;
    if (!children || children.length === 0) {
        return '';
    }

    const whitespaceAtStartOfBlock = checkWhitespaceAtStartOfSvelteBlock(node, options);
    const whitespaceAtEndOfBlock = checkWhitespaceAtEndOfSvelteBlock(node, options);
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

    return concat([
        indent(concat([startline, group(printChildren(path, print, options))])),
        endline,
    ]);
}

function printChildren(path: FastPath, print: PrintFn, options: ParserOptions): Doc {
    if (isPreTagContent(path)) {
        return concat(path.map(print, 'children'));
    }

    const childNodes: Node[] = prepareChildren(path.getValue().children, path, print);
    // modifiy original array because it's accessed later through map(print, 'children', idx)
    path.getValue().children = childNodes;
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

    return concat(childDocs);

    function printChild(idx: number): Doc {
        return path.call(print, 'children', idx);
    }

    /**
     * Print inline child. Hug whitespace of previous text child if there was one.
     */
    function handleInlineChild(idx: number) {
        if (handleWhitespaceOfPrevTextNode) {
            childDocs.push(groupConcat([line, printChild(idx)]));
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
                // so that if the children break, the inline element afterwards is in a seperate line.
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
     * is done in parent already. By defintion of the Svelte AST,
     * a text node always is inbetween other tags. Add hardlines
     * if the users wants to have them inbetween.
     * If the text is trimmed right, toggle flag telling
     * subsequent (inline)block element to alter its printing logic
     * to check if they need to hug or print lines themselves.
     */
    function handleTextChild(idx: number, childNode: TextNode) {
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
                childDocs.push(groupConcat([lastChildDoc, line]));
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
 * `svelte:options` is part of the html part but needs to be snipped out and handled
 * seperately to reorder it as configured. The comment above it should be moved with it.
 * Do that here.
 */
function prepareChildren(children: Node[], path: FastPath, print: PrintFn): Node[] {
    let svelteOptionsComment: Doc | undefined;
    const childrenWithoutOptions = [];

    for (let idx = 0; idx < children.length; idx++) {
        const currentChild = children[idx];

        if (currentChild.type === 'Text' && getUnencodedText(currentChild) === '') {
            continue;
        }

        if (isEmptyTextNode(currentChild) && doesEmbedStartAfterNode(currentChild, path)) {
            continue;
        }

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

        childrenWithoutOptions.push(currentChild);
    }

    const mergedChildrenWithoutOptions = [];

    for (let idx = 0; idx < childrenWithoutOptions.length; idx++) {
        const currentChild = childrenWithoutOptions[idx];
        const nextChild = childrenWithoutOptions[idx + 1];

        if (currentChild.type === 'Text' && nextChild && nextChild.type === 'Text') {
            // A tag was snipped out (f.e. svelte:options). Join text
            currentChild.raw += nextChild.raw;
            currentChild.data += nextChild.data;
            idx++;
        }

        mergedChildrenWithoutOptions.push(currentChild);
    }

    return mergedChildrenWithoutOptions;

    function printSvelteOptions(
        node: OptionsNode,
        idx: number,
        path: FastPath,
        print: PrintFn,
    ): void {
        svelteOptionsDoc = groupConcat([
            groupConcat([
                '<',
                node.name,

                indent(groupConcat(path.map(print, 'children', idx, 'attributes'))),

                ' />',
            ]),
            hardline,
        ]);
        if (svelteOptionsComment) {
            svelteOptionsDoc = groupConcat([svelteOptionsComment, hardline, svelteOptionsDoc]);
        }
    }

    function isCommentFollowedByOptions(node: Node, idx: number): node is CommentNode {
        if (node.type !== 'Comment') {
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
    let docs: Doc[] = text.split(/[\t\n\f\r ]+/);

    docs = join(line, docs).parts.filter((s) => s !== '');

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

function printSvelteBlockJS(path: FastPath, print: PrintFn, name: string) {
    return printJS(path, print, false, true, name);
}

function printJS(
    path: FastPath,
    print: PrintFn,
    forceSingleQuote: boolean,
    forceSingleLine: boolean,
    name: string,
) {
    path.getValue()[name].isJS = true;
    path.getValue()[name].forceSingleQuote = forceSingleQuote;
    path.getValue()[name].forceSingleLine = forceSingleLine;
    return path.call(print, name);
}

function expandNode(node: any): string {
    if (node === null) {
        return '';
    }

    if (typeof node === 'string') {
        // pre-v3.20 AST
        return ' ' + node;
    }

    switch (node.type) {
        case 'ArrayPattern':
            return ' [' + node.elements.map(expandNode).join(',').slice(1) + ']';
        case 'AssignmentPattern':
            return expandNode(node.left) + ' =' + expandNode(node.right);
        case 'Identifier':
            return ' ' + node.name;
        case 'Literal':
            return ' ' + node.raw;
        case 'ObjectPattern':
            return ' {' + node.properties.map(expandNode).join(',') + ' }';
        case 'Property':
            if (node.value.type === 'ObjectPattern') {
                return ' ' + node.key.name + ':' + expandNode(node.value);
            } else if (node.value.type === 'Identifier' && node.key.name !== node.value.name) {
                return expandNode(node.key) + ':' + expandNode(node.value);
            } else {
                return expandNode(node.value);
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

    return groupConcat(['<!--', text, '-->']);
}
