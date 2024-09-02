import { Doc, doc, AstPath } from 'prettier';
import { PrintFn } from '.';
import { formattableAttributes } from '../lib/elements';
import { snippedTagContentAttribute } from '../lib/snipTagContent';
import {
    ASTNode,
    AttributeNode,
    BodyNode,
    DocumentNode,
    ElementNode,
    HeadNode,
    InlineComponentNode,
    Node,
    OptionsNode,
    ScriptNode,
    SlotNode,
    SlotTemplateNode,
    StyleNode,
    TitleNode,
    WindowNode,
} from './nodes';
import { ParserOptions } from '../options';

/**
 * Determines whether or not given node
 * is the root of the Svelte AST.
 */
export function isASTNode(n: any): n is ASTNode {
    return n && n.__isRoot;
}

export function isPreTagContent(path: AstPath): boolean {
    const stack = path.stack as Node[];

    return stack.some(
        (node) =>
            (node.type === 'Element' && node.name.toLowerCase() === 'pre') ||
            (node.type === 'Attribute' && !formattableAttributes.includes(node.name)),
    );
}

export function flatten<T>(arrays: T[][]): T[] {
    return ([] as T[]).concat.apply([], arrays);
}

export function findLastIndex<T>(isMatch: (item: T, idx: number) => boolean, items: T[]) {
    for (let i = items.length - 1; i >= 0; i--) {
        if (isMatch(items[i], i)) {
            return i;
        }
    }

    return -1;
}

export function replaceEndOfLineWith(text: string, replacement: Doc) {
    const parts: Doc[] = [];
    for (const part of text.split('\n')) {
        if (parts.length > 0) {
            parts.push(replacement);
        }
        if (part.endsWith('\r')) {
            parts.push(part.slice(0, -1));
        } else {
            parts.push(part);
        }
    }
    return parts;
}

export function getAttributeLine(
    node:
        | ElementNode
        | InlineComponentNode
        | SlotNode
        | WindowNode
        | HeadNode
        | TitleNode
        | StyleNode
        | ScriptNode
        | BodyNode
        | DocumentNode
        | OptionsNode
        | SlotTemplateNode,
    options: ParserOptions,
) {
    const { hardline, line } = doc.builders;
    const hasThisBinding =
        (node.type === 'InlineComponent' && !!node.expression) ||
        (node.type === 'Element' && !!node.tag);

    const attributes = (node.attributes as Array<AttributeNode>).filter(
        (attribute) => attribute.name !== snippedTagContentAttribute,
    );
    return options.singleAttributePerLine &&
        (attributes.length > 1 || (attributes.length && hasThisBinding))
        ? hardline
        : line;
}

export function printWithPrependedAttributeLine(
    node:
        | ElementNode
        | InlineComponentNode
        | SlotNode
        | WindowNode
        | HeadNode
        | TitleNode
        | StyleNode
        | ScriptNode
        | BodyNode
        | DocumentNode
        | OptionsNode
        | SlotTemplateNode,
    options: ParserOptions,
    print: PrintFn,
): PrintFn {
    return (path) =>
        path.getNode().name !== snippedTagContentAttribute
            ? [getAttributeLine(node, options), path.call(print)]
            : '';
}
