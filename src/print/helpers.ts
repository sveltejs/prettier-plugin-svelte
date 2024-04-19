import { Doc, doc, AstPath } from 'prettier';
import { PrintFn } from '.';
import { formattableAttributes } from '../lib/elements';
import { snippedTagContentAttribute } from '../lib/snipTagContent';
import {
    BaseElement,
    BaseNode,
    Component,
    ElementLike,
    RegularElement,
    Root,
    SlotElement,
    StyleSheet,
    SvelteBody,
    SvelteDocument,
    SvelteElement,
    SvelteFragment,
    SvelteHead,
    SvelteOptions,
    SvelteSelf,
    SvelteWindow,
    TitleElement,
} from './nodes';
import { ParserOptions } from '../options';

/**
 * Determines whether or not given node
 * is the root of the Svelte AST.
 */
export function isASTNode(n: any): n is Root {
    return n && n.type === 'Root';
}

export function isPreTagContent(path: AstPath): boolean {
    const stack = path.stack as Node[];

    return stack.some(
        (node) =>
            (node.type === 'RegularElement' && node.name.toLowerCase() === 'pre') ||
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
        | RegularElement
        | SvelteElement
        | SvelteSelf
        | Component
        | SlotElement
        | SvelteFragment
        | SvelteWindow
        | SvelteHead
        | TitleElement
        | StyleSheet
//        | ScriptNode
        | SvelteBody
        | SvelteDocument
        | SvelteOptions,
    options: ParserOptions,
) {
    const { hardline, line } = doc.builders;
    const hasThisBinding = node.type === 'SvelteComponent' || node.type === 'SvelteElement';

    const attributes = node.attributes.filter(
        (attribute) => attribute.name !== snippedTagContentAttribute,
    );
    return options.singleAttributePerLine &&
        (attributes.length > 1 || (attributes.length && hasThisBinding))
        ? hardline
        : line;
}

export function printWithPrependedAttributeLine(
    node:
        | RegularElement
        | SvelteElement
        | SvelteSelf
        | Component
        | SlotElement
        | SvelteFragment
        | SvelteWindow
        | SvelteHead
        | TitleElement
        | StyleSheet
    //        | ScriptNode
        | SvelteBody
        | SvelteDocument
        | SvelteOptions,
    options: ParserOptions,
    print: PrintFn,
): PrintFn {
    return (path) =>
        path.getNode().name !== snippedTagContentAttribute
            ? [getAttributeLine(node, options), path.call(print)]
            : '';
}
