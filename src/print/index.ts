import { FastPath, Doc, doc, ParserOptions } from 'prettier';
import { Node, MustacheTagNode, IfBlockNode, EachBlockNode } from './nodes';
import { isASTNode, isPreTagContent } from './helpers';
import { extractAttributes } from '../lib/extractAttributes';
import { getText } from '../lib/getText';
import { parseSortOrder, SortOrderPart } from '../options';
import { hasSnippedContent, unsnipContent } from '../lib/snipTagContent';
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
        parseSortOrder(options.svelteSortOrder).forEach(p => addParts[p]());
        return group(join(hardline, parts));
    }

    const [open, close] = ['{', '}'];
    const node = n as Node;
    switch (node.type) {
        case 'Fragment':
            const children = node.children;

            if (children.length === 0 || children.every(isEmptyNode)) {
                return '';
            }

            return concat([printChildren(path, print, options, false), hardline]);
        case 'Text':
            if (isPreTagContent(path, options)) {
                return node.data;
            }

            if (isEmptyNode(node)) {
                return {
                    /**
                     * Empty (whitespace-only) text nodes are collapsed into a single `line`,
                     * which will be rendered as a single space if this node's group fits on a
                     * single line. This follows how vanilla HTML is handled both by browsers and
                     * by Prettier core.
                     */
                    ...line,

                    /**
                     * A text node is considered lonely if it is in a group without other inline
                     * elements, such as the line breaks between otherwise consecutive HTML tags.
                     * Text nodes that are both empty and lonely are discarded unless they have at
                     * least one empty line (i.e. at least two linebreak sequences). This is to
                     * allow for flexible grouping of HTML tags in a particular indentation level,
                     * and is similar to how vanilla HTML is handled in Prettier core.
                     */
                    keepIfLonely: /\n\r?\s*\n\r?/.test(node.raw || node.data),
                };
            }

            /**
             * For non-empty text nodes each sequence of non-whitespace characters (effectively,
             * each "word") is joined by a single `line`, which will be rendered as a single space
             * until this node's current line is out of room, at which `fill` will break at the
             * most convienient instance of `line`.
             */
            return fill(join(line, (node.raw || node.data).split(/[\t\n\f\r ]+/)).parts);
        case 'Element':
        case 'InlineComponent':
        case 'Slot':
        case 'Window':
        case 'Head':
        case 'Title': {
            const notEmpty = node.children.some(child => !isEmptyNode(child));
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
                                          'this={',
                                          printJS(path, print, 'expression'),
                                          '}',
                                      ])
                                    : '',
                                ...path.map(childPath => childPath.call(print), 'attributes'),
                                options.svelteBracketNewLine
                                    ? dedent(notEmpty ? softline : line)
                                    : '',
                            ]),
                        ),
                    ),

                    notEmpty ? '>' : `${options.svelteBracketNewLine ? '' : ' '}/>`,

                    notEmpty ? indent(printChildren(path, print, options)) : '',

                    notEmpty ? concat(['</', node.name, '>']) : '',
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
                        group(concat(path.map(childPath => childPath.call(print), 'attributes'))),
                    ),

                    ' />',
                ]),
            );
        case 'Identifier':
            return node.name;
        case 'Attribute': {
            const hasLoneMustacheTag =
                node.value !== true &&
                node.value.length === 1 &&
                node.value[0].type === 'MustacheTag';
            let isAttributeShorthand =
                node.value !== true &&
                node.value.length === 1 &&
                node.value[0].type === 'AttributeShorthand';

            // Convert a={a} into {a}
            if (hasLoneMustacheTag) {
                const expression = (node.value as [MustacheTagNode])[0].expression;
                isAttributeShorthand =
                    expression.type === 'Identifier' && expression.name === node.name;
            }

            if (isAttributeShorthand) {
                return concat([line, '{', node.name, '}']);
            }

            const def: Doc[] = [line, node.name];
            if (node.value !== true) {
                def.push('=');
                const quotes = !hasLoneMustacheTag;

                quotes && def.push('"');
                def.push(...path.map(childPath => childPath.call(print), 'value'));
                quotes && def.push('"');
            }
            return concat(def);
        }
        case 'MustacheTag':
            return concat(['{', printJS(path, print, 'expression'), '}']);
        case 'IfBlock': {
            const def: Doc[] = [
                '{#if ',
                printJS(path, print, 'expression'),
                '}',
                indent(printChildren(path, print, options)),
            ];

            if (node.else) {
                def.push(path.call(print, 'else'));
            }

            def.push('{/if}');

            return group(concat(def));
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
                    path.map(ifPath => printJS(path, print, 'expression'), 'children')[0],
                    '}',
                    indent(path.map(ifPath => printChildren(ifPath, print, options), 'children')[0]),
                ];

                if (ifNode.else) {
                    def.push(path.map(ifPath => ifPath.call(print, 'else'), 'children')[0]);
                }
                return group(concat(def));
            }

            return group(concat(['{:else}', indent(printChildren(path, print, options))]));
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

            def.push('}', indent(printChildren(path, print, options)));

            if (node.else) {
                def.push(path.call(print, 'else'));
            }

            def.push('{/each}');

            return group(concat(def));
        }
        case 'AwaitBlock': {
            return group(
                concat([
                    group(concat(['{#await ', printJS(path, print, 'expression'), '}'])),
                    indent(path.call(print, 'pending')),
                    group(concat(['{:then', node.value ? ' ' + node.value : '', '}'])),
                    indent(path.call(print, 'then')),
                    group(concat(['{:catch', node.error ? ' ' + node.error : '', '}'])),
                    indent(path.call(print, 'catch')),
                    '{/await}',
                ]),
            );
        }
        case 'ThenBlock':
        case 'PendingBlock':
        case 'CatchBlock':
            return printChildren(path, print, options);
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
                    : concat(['=', '{', printJS(path, print, 'expression'), '}']),
            ]);
        case 'Class':
            return concat([
                line,
                'class:',
                node.name,
                node.expression.type === 'Identifier' && node.expression.name === node.name
                    ? ''
                    : concat(['=', '{', printJS(path, print, 'expression'), '}']),
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
                    : concat(['=', '{', printJS(path, print, 'expression'), '}']),
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

    console.log(JSON.stringify(node, null, 4));
    throw new Error('unknown node type: ' + node.type);
}

function isEmptyGroup(group: Doc[]): boolean {
    if (group.length === 0) {
        return true;
    }

    if (group.length > 1) {
        return false;
    }

    const lonelyDoc = group[0];

    if (typeof lonelyDoc === 'string' || lonelyDoc.type !== 'line') {
        return false;
    }

    return !lonelyDoc.keepIfLonely;
}

/**
 * Due to how `String.prototype.split` works, `TextNode`s with leading whitespace will be printed
 * to a `Fill` that has two additional parts at the begnning: an empty string (`''`) and a `line`.
 * If such a `Fill` doc is present at the beginning of an inline node group, those additional parts
 * need to be removed to prevent additional whitespace at the beginning of the parent's inner
 * content or after a sibling block node (i.e. HTML tags).
 */
function trimLeft(group: Doc[]): void {
    if (group.length === 0) {
        return;
    }

    const first = group[0];
    if (typeof first === 'string') {
        return;
    }

    if (first.type === 'line') {
        group.shift();
        return;
    }

    if (first.type !== 'fill') {
        return;
    }

    // find the index of the first part that isn't an empty string or a line
    const trimIndex = first.parts.findIndex(part =>
        typeof part === 'string' ? part !== '' : part.type !== 'line',
    );

    first.parts.splice(0, trimIndex);
}

/**
 * Due to how `String.prototype.split` works, `TextNode`s with trailing whitespace will be printed
 * to a `Fill` that has two additional parts at the end: a `line` and an empty string (`''`). If
 * such a `Fill` doc is present at the beginning of an inline node group, those additional parts
 * need to be removed to prevent additional whitespace at the end of the parent's inner content or
 * before a sibling block node (i.e. HTML tags).
 */
function trimRight(group: Doc[]): void {
    if (group.length === 0) {
        return;
    }

    const last = group[group.length - 1];
    if (typeof last === 'string') {
        return;
    }

    if (last.type === 'line') {
        group.pop();
        return;
    }

    if (last.type !== 'fill') {
        return;
    }

    last.parts.reverse();

    // find the index of the first part that isn't an empty string or a line
    const trimIndex = last.parts.findIndex(part =>
        typeof part === 'string' ? part !== '' : part.type !== 'line',
    );

    last.parts.splice(0, trimIndex);
    last.parts.reverse();
}

function printChildren(path: FastPath, print: PrintFn, options: ParserOptions, surroundingLines = true): Doc {
    if (isPreTagContent(path, options)) {
        return concat(path.map(print, 'children'));
    }

    const childDocs: Doc[] = [];
    let currentGroup: Doc[] = [];

    /**
     * Sequences of inline nodes (currently, `TextNode`s and `MustacheTag`s) are collected into
     * groups and printed as a single `Fill` doc so that linebreaks as a result of sibling block
     * nodes (currently, all HTML elements) don't cause those inline sequences to break
     * prematurely. This is particularly important for whitespace sensitivity, as it is often
     * desired to have text directly wrapping a mustache tag without additional whitespace.
     */
    function flush() {
        if (!isEmptyGroup(currentGroup)) {
            trimLeft(currentGroup);
            trimRight(currentGroup);
            childDocs.push(fill(currentGroup));
        }
        currentGroup = [];
    }

    path.each(childPath => {
        const childNode = childPath.getValue() as Node;
        const childDoc = childPath.call(print);

        if (isInlineNode(childNode)) {
            currentGroup.push(childDoc);
        } else {
            flush();
            childDocs.push(concat([breakParent, childDoc]));
        }
    }, 'children');

    flush();

    return concat([
        surroundingLines ? softline : '',
        join(hardline, childDocs),
        surroundingLines ? dedent(softline) : '',
    ]);
}

function printJS(path: FastPath, print: PrintFn, name?: string) {
    if (!name) {
        path.getValue().isJS = true;
        return path.call(print);
    }

    path.getValue()[name].isJS = true;
    return path.call(print, name);
}

function isInlineNode(node: Node): boolean {
    return node.type === 'Text' || node.type === 'MustacheTag';
}

function isEmptyNode(node: Node): boolean {
    return node.type === 'Text' && (node.raw || node.data).trim() === '';
}
