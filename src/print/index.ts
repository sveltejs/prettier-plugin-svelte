import { FastPath, Doc, doc } from 'prettier';
import { Node, MustacheTagNode, IfBlockNode } from './nodes';
import { isASTNode } from './helpers';
const { concat, join, line, group, indent, softline, hardline } = doc.builders;

export type PrintFn = (path: FastPath) => Doc;

export function print(path: FastPath, options: object, print: PrintFn): Doc | null {
    const n = path.getValue();
    if (!n) {
        return '';
    }

    if (isASTNode(n)) {
        const parts = [path.call(print, 'html')];
        if (n.css) {
            n.css.type = 'Style';
            n.css.content.type = 'StyleProgram';
            parts.push(path.call(print, 'css'));
        }
        if (n.js) {
            n.js.type = 'Script';
            parts.push(path.call(print, 'js'));
        }
        return group(join(hardline, parts));
    }

    const node = n as Node;
    switch (node.type) {
        case 'Fragment':
            const children = node.children;
            return concat([
                printChildren(path, print, {
                    skipFirst: true,
                    filter: (node: Node, i: number) => {
                        if (i === 0 && node.type === 'Text' && node.data.trim() === '') {
                            return false;
                        }

                        let include = false;
                        for (let j = i; j < children.length; j++) {
                            const child = children[j];
                            if (!(child.type === 'Text' && child.data.trim() === '')) {
                                include = true;
                                break;
                            }
                        }

                        return include;
                    },
                }),
                hardline,
            ]);
        case 'Text':
            return join(
                hardline,
                node.data
                    .replace(/\n(?!\n)/g, '')
                    .replace(/[ \t]+/g, ' ')
                    .split(/\n/g),
            );
        case 'Element':
        case 'InlineComponent':
        case 'Slot':
        case 'Window':
        case 'Head':
        case 'Title':
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
                            ]),
                        ),
                    ),

                    node.children.length ? '>' : ' />',

                    indent(printChildren(path, print)),

                    node.children.length ? concat([softline, '</', node.name, '>']) : '',
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
                indent(printChildren(path, print)),
                line,
            ];

            if (node.else) {
                def.push(path.call(print, 'else'));
            }

            def.push('{/if}');

            return group(concat(def));
        }
        case 'ElseBlock': {
            // Else if
            if (node.children.length === 1 && node.children[0].type === 'IfBlock') {
                const ifNode = node.children[0] as IfBlockNode;
                const def: Doc[] = [
                    '{:elseif ',
                    path.map(ifPath => printJS(path, print, 'expression'), 'children')[0],
                    '}',
                    indent(path.map(ifPath => printChildren(ifPath, print), 'children')[0]),
                    line,
                ];

                if (ifNode.else) {
                    def.push(path.map(ifPath => ifPath.call(print, 'else'), 'children')[0]);
                }
                return group(concat(def));
            }

            return group(concat(['{:else}', indent(printChildren(path, print)), line]));
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

            def.push('}', indent(printChildren(path, print)), line);

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
                    line,
                    group(concat(['{:then', node.value ? ' ' + node.value : '', '}'])),
                    indent(path.call(print, 'then')),
                    line,
                    group(concat(['{:catch', node.error ? ' ' + node.error : '', '}'])),
                    indent(path.call(print, 'catch')),
                    line,
                    '{/await}',
                ]),
            );
        }
        case 'ThenBlock':
        case 'PendingBlock':
        case 'CatchBlock':
            return printChildren(path, print);
        case 'EventHandler':
            return concat([
                line,
                'on:',
                node.name,
                node.expression ? concat(['=', '"', printJS(path, print, 'expression'), '"']) : '',
            ]);
        case 'Binding':
            return concat([
                line,
                'bind:',
                node.name,
                node.value.type === 'Identifier' && node.value.name === node.name
                    ? ''
                    : concat(['=', '"', printJS(path, print, 'value'), '"']),
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
        case 'Comment':
            return group(concat(['<!--', node.data, '-->']));
        case 'Transition':
            const kind = node.intro && node.outro ? 'transition' : node.intro ? 'in' : 'out';
            return concat([
                line,
                kind,
                ':',
                node.name,
                node.expression ? concat(['=', '"', printJS(path, print, 'expression'), '"']) : '',
            ]);
        case 'Action':
            return concat([
                line,
                'use:',
                node.name,
                node.expression ? concat(['=', '"', printJS(path, print, 'expression'), '"']) : '',
            ]);
        case 'Animation':
            return concat([
                line,
                'animate:',
                node.name,
                node.expression ? concat(['=', '"', printJS(path, print, 'expression'), '"']) : '',
            ]);
        case 'RawMustacheTag':
            return concat(['{@html ', printJS(path, print, 'expression'), '}']);
        case 'Spread':
            return concat([line, '{...', printJS(path, print, 'expression'), '}']);
    }

    console.log(JSON.stringify(node, null, 4));
    throw new Error('unknown node type: ' + node.type);
}

function printChildren(
    path: FastPath,
    print: PrintFn,
    { skipFirst = false, filter = (node: Node, i: number) => true } = {},
): Doc {
    const children: Doc[] = [];
    let i = 0;
    let isFirst = true;
    const childNodes = path.getValue().children as Node[];
    path.each(childPath => {
        const child = childPath.getValue() as Node;
        const index = i;
        i++;

        if (!filter(child, index)) {
            return;
        }

        if (!(isFirst && skipFirst)) {
            if (isInlineNode(child)) {
                if (!isEmptyNode(child)) {
                    let lineType: Doc = softline;
                    if (child.type === 'Text') {
                        if (/^\s+/.test(child.data)) {
                            // Remove leading spaces
                            child.data = trimStart(child.data);
                            if (!isFirst) {
                                lineType = line;
                            }
                        }
                    }

                    children.push(lineType);
                }
            } else {
                children.push(hardline);
            }
        }

        if (child.type === 'Text') {
            if (isLastNode(childNodes, filter, index)) {
                // Remove trailing spaces
                child.data = trimEnd(child.data);
            }
        }

        children.push(childPath.call(print));
        isFirst = false;
    }, 'children');
    return concat(children);
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
    return node.type === 'Text' && node.data.trim() === '';
}

function isLastNode(
    nodes: Node[],
    filter: (node: Node, i: number) => boolean,
    index: number,
): boolean {
    for (let i = index + 1; i < nodes.length; i++) {
        if (filter(nodes[i], i)) {
            return false;
        }
    }

    return true;
}

function trimStart(text: string): string {
    return text.replace(/^\s+/, '');
}

function trimEnd(text: string): string {
    return text.replace(/\s+$/, '');
}
