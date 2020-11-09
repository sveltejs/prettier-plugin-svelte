import { Doc, doc, FastPath, ParserOptions } from 'prettier';
import { formattableAttributes, selfClosingTags } from '../lib/elements';
import { extractAttributes } from '../lib/extractAttributes';
import { getText } from '../lib/getText';
import { hasSnippedContent, unsnipContent } from '../lib/snipTagContent';
import { parseSortOrder, SortOrderPart } from '../options';
import { isLine, trim } from './doc-helpers';
import { flatten, isASTNode, isPreTagContent } from './helpers';
import {
    doesEmbedStartAt,
    getUnencodedText,
    isEmptyNode,
    isIgnoreDirective,
    isInlineElement,
    isLoneMustacheTag,
    isNodeSupportedLanguage,
    isOrCanBeConvertedToShorthand,
    isTextNodeEndingWithLinebreak,
    isTextNodeStartingWithLinebreak,
    printRaw,
    trimChildren,
    trimTextNodeLeft,
    trimTextNodeRight,
} from './node-helpers';
import { AttributeNode, ElementType, IfBlockNode, Node, TextNode } from './nodes';

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
        return group(join(hardline, parts));
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
                return concat([
                    ...trim(
                        [printChildren2('inlineEl', path, print, options)],
                        (n) => isLine(n) || (typeof n === 'string' && n.trim() === ''),
                    ),
                    hardline,
                ]);
            } else {
                return printChildren2('inlineEl', path, print, options);
            }
        case 'Text':
            if (!isPreTagContent(path)) {
                if (isEmptyNode(node)) {
                    if (node.isFirstInsideParent || node.isLastInsideParent) {
                        return ''; // correct handling done by parent already
                    }
                    const hasWhiteSpace =
                        getUnencodedText(node).trim().length < getUnencodedText(node).length;
                    const hasOneOrMoreNewlines = /\n/.test(getUnencodedText(node));
                    const hasTwoOrMoreNewlines = /\n\r?\s*\n\r?/.test(getUnencodedText(node));
                    if (node.isBetweenTags && hasTwoOrMoreNewlines) {
                        return concat([hardline, hardline]);
                    }
                    if (hasOneOrMoreNewlines) {
                        return hardline;
                    }
                    if (hasWhiteSpace) {
                        return line;
                    }
                    return node.parentType === 'inlineEl' ? '' : softline;
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
            let body: Doc;

            if (isEmpty) {
                body = '';
            } else if (!isSupportedLanguage) {
                body = printRaw(node, options.originalText);
            } else if (isInlineElement(node) || isPreTagContent(path)) {
                body = printChildren2('inlineEl', path, print, options);
            } else {
                body = printChildren2('blockEl', path, print, options);
            }

            return group(
                concat([
                    '<',
                    node.name,

                    indent(
                        group(
                            concat([
                                node.type === 'InlineComponent' && node.expression
                                    ? concat([
                                          line,
                                          'this=',
                                          open,
                                          printJS(path, print, 'expression'),
                                          close,
                                      ])
                                    : '',
                                ...attributes,
                                options.svelteBracketNewLine
                                    ? dedent(isSelfClosingTag ? line : softline)
                                    : '',
                            ]),
                        ),
                    ),

                    ...(isSelfClosingTag
                        ? [options.svelteBracketNewLine ? '' : ' ', `/>`]
                        : ['>', body, `</${node.name}>`]),
                ]),
            );
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
            return node.expression.name;
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
                printChildren2('svelteExpr', path, print, options),
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
                    path.map((ifPath) => printJS(path, print, 'expression'), 'children')[0],
                    '}',
                    path.map(
                        (ifPath) => printChildren2('svelteExpr', ifPath, print, options),
                        'children',
                    )[0],
                ];

                if (ifNode.else) {
                    def.push(path.map((ifPath) => ifPath.call(print, 'else'), 'children')[0]);
                }
                return group(concat(def));
            }

            return group(concat(['{:else}', printChildren2('svelteExpr', path, print, options)]));
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

            def.push('}', printChildren2('svelteExpr', path, print, options));

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
                printChildren2('svelteExpr', path, print, options),
            ];

            def.push('{/key}');

            return concat([group(concat(def)), breakParent]);
        }
        case 'ThenBlock':
        case 'PendingBlock':
        case 'CatchBlock':
            return printChildren2('svelteExpr', path, print, options);
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

function printChildren2(
    elementType: ElementType,
    path: FastPath,
    print: PrintFn,
    options: ParserOptions,
): Doc {
    // Rules:
    // Parent is SvelteBlock:
    // - if newline at start or end
    //  -> newlines at start/end
    // Parent is Block:
    // - if newline at start or end
    //  -> newlines at start/end. trim rest at start/end
    //  -> else trim all whitespaces at start/end + do softline
    // - if has more than one child
    //  -> break into new lines according to whitespace sensitivity
    // Parent is InlineBlock:
    // - if newline at start and end
    //  -> newlines at start/end. trim rest at start/end.
    //  -> else trim all whitespace except one at start/end -> line or nothing
    // All Text:
    // - if a child and followed/preceeded by non-text, keep at most two newlines

    if (isPreTagContent(path)) {
        return concat(path.map(print, 'children'));
    }

    const children: Node[] = path.getValue().children;
    if (children.length === 0) {
        return '';
    }

    children.forEach((child: any) => (child.parentElType = elementType));
    children.slice(1, -1).forEach((child) => {
        if (child.type === 'Text') {
            child.isBetweenTags = true;
        }
    });

    const hasOnlyTextAndMoustacheChildren = children.every(
        (child) => child.type === 'Text' || child.type === 'MustacheTag',
    );
    const firstChild = children[0];
    const lastChild = children[children.length - 1];

    if (firstChild.type === 'Text') {
        firstChild.isFirstInsideParent = true;
    }
    if (lastChild.type === 'Text') {
        lastChild.isLastInsideParent = true;
    }

    if (elementType === 'svelteExpr') {
        // Is a {#if/each/await/key} block
        const parentOpeningEnd = options.originalText.lastIndexOf('}', children[0].start);
        let line: Doc = softline;
        if (parentOpeningEnd > 0 && firstChild.start > parentOpeningEnd + 1) {
            const textBetween = options.originalText.substring(
                parentOpeningEnd + 1,
                firstChild.start,
            );
            if (textBetween.trim() === '') {
                line = hardline;
            }
        }
        if (isTextNodeStartingWithLinebreak(firstChild)) {
            trimTextNodeLeft(firstChild);
            line = hardline;
        }
        if (isTextNodeEndingWithLinebreak(lastChild)) {
            trimTextNodeRight(lastChild);
            line = hardline;
        }
        return concat([
            indent(concat([line, group(concat(trim(path.map(print, 'children'), isLine)))])),
            line,
        ]);
    }

    if (elementType === 'blockEl') {
        let line: Doc = softline;
        if (firstChild === lastChild && firstChild.type === 'Text') {
            trimTextNodeLeft(firstChild);
            trimTextNodeRight(firstChild);
        } else {
            if (isTextNodeStartingWithLinebreak(firstChild)) {
                trimTextNodeLeft(firstChild);
                line = hardline;
            }
            if (isTextNodeEndingWithLinebreak(lastChild)) {
                trimTextNodeRight(lastChild);
            }
        }

        return concat([
            indent(
                concat([
                    line,
                    ...path.map(print, 'children'),
                    // TODO not that simple unfortunately: only break around block elements when there's more than one
                    // hasOnlyTextAndMoustacheChildren ? '' : breakParent,
                ]),
            ),
            line,
        ]);
    } else {
        if (
            firstChild !== lastChild &&
            isTextNodeStartingWithLinebreak(firstChild) &&
            isTextNodeEndingWithLinebreak(lastChild)
        ) {
            trimTextNodeLeft(firstChild);
            trimTextNodeRight(lastChild);
            return concat([indent(concat([hardline, ...path.map(print, 'children')])), hardline]);
        }
        return concat(path.map(print, 'children'));
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

    if (text.match(/^([\t\f\r ]*\n)/)) {
        docs[0] = hardline;
    }
    if (text.match(/^([\t\f\r ]*\n){2}/) && (node.isBetweenTags || node.isLastInsideParent)) {
        docs = [hardline, ...docs];
    }

    if (text.match(/(\n[\t\f\r ]*)$/)) {
        docs[docs.length - 1] = hardline;
    }
    if (text.match(/(\n[\t\f\r ]*){2}$/) && node.isBetweenTags) {
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

function expandNode(node): string {
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
