import { Doc, doc, FastPath, ParserOptions } from 'prettier';
import { formattableAttributes, selfClosingTags } from '../lib/elements';
import { extractAttributes } from '../lib/extractAttributes';
import { getText } from '../lib/getText';
import { hasSnippedContent, unsnipContent } from '../lib/snipTagContent';
import { parseSortOrder, SortOrderPart } from '../options';
import { isLine, trim } from './doc-helpers';
import { flatten, isASTNode, isPreTagContent } from './helpers';
import {
    checkWhitespaceAtEndOfSvelteBlock,
    checkWhitespaceAtStartOfSvelteBlock,
    doesEmbedStartAt,
    endsWithLinebreak,
    getUnencodedText,
    isBlockElement,
    isEmptyNode,
    isIgnoreDirective,
    isInlineElement,
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
} from './node-helpers';
import { AttributeNode, IfBlockNode, Node, TextNode } from './nodes';

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

function groupConcat(contents: doc.builders.Doc[]): doc.builders.Doc {
    return group(concat(contents));
}

export function print(path: FastPath, options: ParserOptions, print: PrintFn): Doc {
    const n = path.getValue();
    if (!n) {
        return '';
    }

    if (isASTNode(n)) {
        const parts: doc.builders.Doc[] = [];
        const addParts: Record<SortOrderPart, () => void> = {
            scripts() {
                if (n.module) {
                    n.module.type = 'Script';
                    n.module.attributes = extractAttributes(getText(n.module, options));
                    parts.push(path.call(print, 'module'));
                }
                if (n.instance) {
                    n.instance.type = 'Script';
                    n.instance.attributes = extractAttributes(getText(n.instance, options));
                    parts.push(path.call(print, 'instance'));
                }
            },
            styles() {
                if (n.css) {
                    n.css.type = 'Style';
                    n.css.content.type = 'StyleProgram';
                    parts.push(path.call(print, 'css'));
                }
            },
            markup() {
                const htmlDoc = path.call(print, 'html');
                if (htmlDoc) {
                    parts.push(htmlDoc);
                }
            },
        };
        parseSortOrder(options.svelteSortOrder).forEach((p) => addParts[p]());
        ignoreNext = false;
        return group(concat([join(hardline, parts)]));
    }

    const [open, close] = options.svelteStrictMode ? ['"{', '}"'] : ['{', '}'];
    const node = n as Node;

    if (ignoreNext && (node.type !== 'Text' || !isEmptyNode(node))) {
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

            if (children.length === 0 || children.every(isEmptyNode)) {
                return '';
            }
            if (!isPreTagContent(path)) {
                trimChildren(node.children, path);
                return group(
                    concat([
                        ...trim(
                            [printChildren(path, print)],
                            (n) =>
                                isLine(n) ||
                                (typeof n === 'string' && n.trim() === '') ||
                                // Because printChildren may append this at the end and
                                // may hide other lines before it
                                n === breakParent,
                        ),
                        hardline,
                    ]),
                );
            } else {
                return group(concat(path.map(print, 'children')));
            }
        case 'Text':
            if (!isPreTagContent(path)) {
                if (isEmptyNode(node)) {
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
            const isEmpty = node.children.every((child) => isEmptyNode(child));

            const isSelfClosingTag =
                isEmpty &&
                (!options.svelteStrictMode ||
                    node.type !== 'Element' ||
                    selfClosingTags.indexOf(node.name) !== -1);

            // Order important: print attributes first
            const attributes = path.map((childPath) => childPath.call(print), 'attributes');
            const possibleThisBinding =
                node.type === 'InlineComponent' && node.expression
                    ? concat([line, 'this=', open, printJS(path, print, 'expression'), close])
                    : '';

            if (isSelfClosingTag) {
                return group(
                    concat([
                        '<',
                        node.name,

                        indent(
                            group(
                                concat([
                                    possibleThisBinding,
                                    ...attributes,
                                    options.svelteBracketNewLine ? dedent(line) : '',
                                ]),
                            ),
                        ),

                        ...[options.svelteBracketNewLine ? '' : ' ', `/>`],
                    ]),
                );
            }

            const children = node.children;
            const firstChild = children[0];
            const lastChild = children[children.length - 1];

            // Is a function which is invoked later because printChildren will manipulate child nodes
            // which would wrongfully change the other checks about hugging etc done beforehand
            let body: () => Doc;

            let hugContent = false;
            const hugStart = shouldHugStart(node, isSupportedLanguage);
            const hugEnd = shouldHugEnd(node, isSupportedLanguage);

            if (isEmpty) {
                body =
                    isInlineElement(node) &&
                    node.children.length &&
                    isTextNodeStartingWithWhitespace(node.children[0]) &&
                    !isPreTagContent(path)
                        ? () => line
                        : () => softline;
            } else if (isPreTagContent(path)) {
                body = () => printRaw(node, options.originalText);
            } else if (!isSupportedLanguage) {
                body = () => printRaw(node, options.originalText);
                hugContent = true;
            } else if (isInlineElement(node) && !isPreTagContent(path)) {
                body = () => printChildren(path, print);
                hugContent = true;
            } else {
                body = () => printChildren(path, print);
            }

            const openingTag = [
                '<',
                node.name,

                indent(
                    group(
                        concat([
                            possibleThisBinding,
                            ...attributes,
                            hugContent
                                ? ''
                                : options.svelteBracketNewLine && !isPreTagContent(path)
                                ? dedent(softline)
                                : '',
                        ]),
                    ),
                ),
            ];

            if (hugStart && hugEnd) {
                return groupConcat([
                    ...openingTag,
                    group(indent(concat([softline, groupConcat(['>', body(), `</${node.name}`])]))),
                    softline,
                    '>',
                ]);
            }

            if (hugStart) {
                return groupConcat([
                    ...openingTag,
                    group(indent(concat([softline, groupConcat(['>', body()])]))),
                    softline,
                    `</${node.name}>`,
                ]);
            }

            if (hugEnd) {
                return groupConcat([
                    ...openingTag,
                    '>',
                    group(indent(concat([softline, groupConcat([body(), `</${node.name}`])]))),
                    softline,
                    '>',
                ]);
            }

            if (isEmpty) {
                return groupConcat([...openingTag, '>', body(), `</${node.name}>`]);
            }

            // No hugging of content means it's either a block element and/or there's whitespace at the start/end
            let separatorStart: Doc = softline;
            let separatorEnd: Doc = softline;
            if (isPreTagContent(path)) {
                separatorStart = '';
                separatorEnd = '';
            } else {
                if (firstChild && firstChild.type === 'Text') {
                    if (isTextNodeStartingWithLinebreak(firstChild) && firstChild !== lastChild) {
                        separatorStart = hardline;
                        separatorEnd = hardline;
                    } else if (isInlineElement(node)) {
                        separatorStart = line;
                    }
                    trimTextNodeLeft(firstChild);
                }
                if (lastChild && lastChild.type === 'Text') {
                    if (isInlineElement(node)) {
                        separatorEnd = line;
                    }
                    trimTextNodeRight(lastChild);
                }
            }

            return groupConcat([
                ...openingTag,
                '>',
                groupConcat([indent(concat([separatorStart, body()])), separatorEnd]),
                `</${node.name}>`,
            ]);
        }
        case 'Options':
        case 'Body':
            return group(
                concat([
                    '<',
                    node.name,

                    indent(
                        group(concat(path.map((childPath) => childPath.call(print), 'attributes'))),
                    ),

                    ' />',
                ]),
            );
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
            return concat(['{', printJS(path, print, 'expression'), '}']);
        case 'IfBlock': {
            const def: Doc[] = [
                '{#if ',
                printJS(path, print, 'expression'),
                '}',
                printSvelteBlockChildren(path, print, options),
            ];

            if (node.else) {
                def.push(path.call(print, 'else'));
            }

            def.push('{/if}');

            return concat([group(concat(def)), breakParent]);
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
                    path.map((ifPath) => printJS(ifPath, print, 'expression'), 'children')[0],
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
                printJS(path, print, 'expression'),
                ' as ',
                printJS(path, print, 'context'),
            ];

            if (node.index) {
                def.push(', ', node.index);
            }

            if (node.key) {
                def.push(' (', printJS(path, print, 'key'), ')');
            }

            def.push('}', printSvelteBlockChildren(path, print, options));

            if (node.else) {
                def.push(path.call(print, 'else'));
            }

            def.push('{/each}');

            return concat([group(concat(def)), breakParent]);
        }
        case 'AwaitBlock': {
            const hasPendingBlock = node.pending.children.some((n) => !isEmptyNode(n));
            const hasThenBlock = node.then.children.some((n) => !isEmptyNode(n));
            const hasCatchBlock = node.catch.children.some((n) => !isEmptyNode(n));

            let block = [];

            if (!hasPendingBlock && hasThenBlock) {
                block.push(
                    group(
                        concat([
                            '{#await ',
                            printJS(path, print, 'expression'),
                            ' then',
                            expandNode(node.value),
                            '}',
                        ]),
                    ),
                    path.call(print, 'then'),
                );
            } else {
                block.push(group(concat(['{#await ', printJS(path, print, 'expression'), '}'])));

                if (hasPendingBlock) {
                    block.push(path.call(print, 'pending'));
                }

                if (hasThenBlock) {
                    block.push(
                        group(concat(['{:then', expandNode(node.value), '}'])),
                        path.call(print, 'then'),
                    );
                }
            }

            if (hasCatchBlock) {
                block.push(
                    group(concat(['{:catch', expandNode(node.error), '}'])),
                    path.call(print, 'catch'),
                );
            }

            block.push('{/await}');

            return group(concat(block));
        }
        case 'KeyBlock': {
            const def: Doc[] = [
                '{#key ',
                printJS(path, print, 'expression'),
                '}',
                printSvelteBlockChildren(path, print, options),
            ];

            def.push('{/key}');

            return concat([group(concat(def)), breakParent]);
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
                node.expression
                    ? concat(['=', open, printJS(path, print, 'expression'), close])
                    : '',
            ]);
        case 'Binding':
            return concat([
                line,
                'bind:',
                node.name,
                node.expression.type === 'Identifier' && node.expression.name === node.name
                    ? ''
                    : concat(['=', open, printJS(path, print, 'expression'), close]),
            ]);
        case 'Class':
            return concat([
                line,
                'class:',
                node.name,
                node.expression.type === 'Identifier' && node.expression.name === node.name
                    ? ''
                    : concat(['=', open, printJS(path, print, 'expression'), close]),
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
                    : concat(['=', open, printJS(path, print, 'expression'), close]),
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
            /**
             * If there is no sibling node that starts right after us but the parent indicates
             * that there used to be, that means that node was actually an embedded `<style>`
             * or `<script>` node that was cut out.
             * If so, the comment does not refer to the next line we will see.
             * The `embed` function handles printing the comment in the right place.
             */
            if (doesEmbedStartAt(node.end, path)) {
                return '';
            } else if (isIgnoreDirective(node)) {
                ignoreNext = true;
            }

            let text = node.data;

            if (hasSnippedContent(text)) {
                text = unsnipContent(text);
            }

            return group(concat(['<!--', text, '-->']));
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
                node.expression
                    ? concat(['=', open, printJS(path, print, 'expression'), close])
                    : '',
            ]);
        case 'Action':
            return concat([
                line,
                'use:',
                node.name,
                node.expression
                    ? concat(['=', open, printJS(path, print, 'expression'), close])
                    : '',
            ]);
        case 'Animation':
            return concat([
                line,
                'animate:',
                node.name,
                node.expression
                    ? concat(['=', open, printJS(path, print, 'expression'), close])
                    : '',
            ]);
        case 'RawMustacheTag':
            return concat(['{@html ', printJS(path, print, 'expression'), '}']);
        case 'Spread':
            return concat([line, '{...', printJS(path, print, 'expression'), '}']);
    }

    console.error(JSON.stringify(node, null, 4));
    throw new Error('unknown node type: ' + node.type);
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
        return indent(group(concat(trim(valueDocs, isLine))));
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

    return concat([indent(concat([startline, group(printChildren(path, print))])), endline]);
}

function printChildren(path: FastPath, print: PrintFn): Doc {
    if (isPreTagContent(path)) {
        return concat(path.map(print, 'children'));
    }

    const childNodes: Node[] = path
        .getValue()
        .children.filter((child: Node) => child.type !== 'Text' || getUnencodedText(child) !== '');
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
        } else if (isBlockElement(path, childNode)) {
            handleBlockChild(i);
        } else if (isInlineElement(childNode)) {
            handleInlineChild(i);
        } else {
            childDocs.push(printChild(i));
            handleWhitespaceOfPrevTextNode = false;
        }
    }

    // If there's at least one block element and more than one node, break content
    const forceBreakContent =
        childNodes.length > 1 && childNodes.some((child) => isBlockElement(path, child));
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
            !isBlockElement(path, prevChild) &&
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
                ((!isEmptyNode(nextChild) ||
                    (childNodes[idx + 2] && isInlineElement(childNodes[idx + 2]))) &&
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
            !isEmptyNode(childNode)
        ) {
            if (isInlineElement(prevNode) && !isTextNodeStartingWithLinebreak(childNode)) {
                trimTextNodeLeft(childNode);
                const lastChildDoc = childDocs.pop()!;
                childDocs.push(groupConcat([lastChildDoc, line]));
            }

            if (isBlockElement(path, prevNode) && !isTextNodeStartingWithLinebreak(childNode)) {
                trimTextNodeLeft(childNode);
            }
        }

        if (isTextNodeEndingWithWhitespace(childNode)) {
            if (isInlineElement(nextNode) && !isTextNodeEndingWithLinebreak(childNode)) {
                handleWhitespaceOfPrevTextNode = !prevNode || !isBlockElement(path, prevNode);
                trimTextNodeRight(childNode);
            }
            if (isBlockElement(path, nextNode) && !isTextNodeEndingWithLinebreak(childNode, 2)) {
                handleWhitespaceOfPrevTextNode = !prevNode || !isBlockElement(path, prevNode);
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

function printJS(path: FastPath, print: PrintFn, name?: string) {
    if (!name) {
        path.getValue().isJS = true;
        return path.call(print);
    }

    path.getValue()[name].isJS = true;
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
