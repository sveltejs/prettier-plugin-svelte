import {
    Node,
    ElementNode,
    TextNode,
    AttributeNode,
    MustacheTagNode,
    AttributeShorthandNode,
    HeadNode,
    InlineComponentNode,
    SlotNode,
    TitleNode,
    WindowNode,
    IfBlockNode,
    AwaitBlockNode,
    CatchBlockNode,
    EachBlockNode,
    ElseBlockNode,
    KeyBlockNode,
    PendingBlockNode,
    ThenBlockNode,
} from './nodes';
import { inlineElements, TagName } from '../lib/elements';
import { FastPath } from 'prettier';
import { findLastIndex, isASTNode, isPreTagContent } from './helpers';

const unsupportedLanguages = ['coffee', 'coffeescript', 'pug', 'styl', 'stylus', 'sass'];

export function isInlineElement(node: Node) {
    return node.type === 'Element' && inlineElements.includes(node.name as TagName);
}

export function isBlockElement(path: FastPath, node: Node): node is ElementNode {
    // TODO switch to a list of tags instead
    return node && node.type === 'Element' && !isInlineElement(node) && !isPreTagContent(path);
}

export function isSvelteBlock(
    node: Node,
): node is
    | IfBlockNode
    | AwaitBlockNode
    | CatchBlockNode
    | EachBlockNode
    | ElseBlockNode
    | KeyBlockNode
    | PendingBlockNode
    | ThenBlockNode {
    return [
        'IfBlock',
        'AwaitBlock',
        'CatchBlock',
        'EachBlock',
        'ElseBlock',
        'KeyBlock',
        'PendingBlock',
        'ThenBlock',
    ].includes(node.type);
}

export function isWhitespaceChar(ch: string) {
    return ' \t\n\r'.indexOf(ch) >= 0;
}

export function canBreakAfter(node: Node) {
    switch (node.type) {
        case 'Text':
            return isWhitespaceChar(node.raw[node.raw.length - 1]);
        case 'Element':
            return !isInlineElement(node);
        case 'IfBlock':
        case 'EachBlock':
        case 'MustacheTag':
            return false;
        default:
            return true;
    }
}

export function canBreakBefore(node: Node) {
    switch (node.type) {
        case 'Text':
            return isWhitespaceChar(node.raw[0]);
        case 'Element':
            return !isInlineElement(node);
        case 'IfBlock':
        case 'EachBlock':
        case 'MustacheTag':
            return false;
        default:
            return true;
    }
}

export function isInlineNode(node: Node): boolean {
    switch (node.type) {
        case 'Text':
            const text = getUnencodedText(node);
            const isAllWhitespace = text.trim() === '';

            return !isAllWhitespace || text === '';
        case 'MustacheTag':
        case 'EachBlock':
        case 'IfBlock':
            return true;
        case 'Element':
            return isInlineElement(node);
        default:
            return false;
    }
}

export function isNodeWithChildren(node: Node): node is Node & { children: Node[] } {
    return (node as any).children;
}

export function getChildren(node: Node): Node[] {
    return isNodeWithChildren(node) ? node.children : [];
}

/**
 * Returns the previous sibling node.
 */
export function getPreviousNode(path: FastPath): Node | undefined {
    const node: Node = path.getNode();
    let parent: Node = path.getParentNode();

    if (isASTNode(parent)) {
        parent = parent.html;
    }

    return getChildren(parent).find((child) => child.end === node.start);
}

/**
 * Did there use to be any embedded object (that has been snipped out of the AST to be moved)
 * at the specified position?
 */
export function doesEmbedStartAt(position: number, path: FastPath) {
    const root = path.stack[0];
    const embeds = [root.css, root.html, root.instance, root.js, root.module] as Node[];

    return embeds.find((n) => n && n.start === position) != null;
}

export function isEmptyNode(node: Node): node is TextNode {
    return node.type === 'Text' && getUnencodedText(node).trim() === '';
}

export function isIgnoreDirective(node: Node | undefined | null): boolean {
    return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore';
}

export function printRaw(
    node: ElementNode | InlineComponentNode | SlotNode | WindowNode | HeadNode | TitleNode,
    originalText: string,
): string {
    if (node.children.length === 0) {
        return '';
    }

    const firstChild = node.children[0];
    const lastChild = node.children[node.children.length - 1];
    return originalText.substring(firstChild.start, lastChild.end);
}

function isTextNode(node: Node): node is TextNode {
    return node.type === 'Text';
}

function getAttributeValue(attributeName: string, node: Node) {
    const attributes = (node as ElementNode)['attributes'] as AttributeNode[];

    const langAttribute = attributes.find(
        (attribute) => attribute.name === attributeName,
    ) as AttributeNode | null;

    return langAttribute && langAttribute.value;
}

export function getAttributeTextValue(attributeName: string, node: Node): string | null {
    const value = getAttributeValue(attributeName, node);

    if (value != null && typeof value === 'object') {
        const textValue = value.find(isTextNode);

        if (textValue) {
            return textValue.data;
        }
    }

    return null;
}

function getLangAttribute(node: Node): string | null {
    const value = getAttributeTextValue('lang', node) || getAttributeTextValue('type', node);

    if (value != null) {
        return value.replace(/^text\//, '');
    } else {
        return null;
    }
}

/**
 * Checks whether the node contains a `lang` attribute with a value corresponding to
 * a language we cannot format. This might for example be `<template lang="pug">`.
 * If the node does not contain a `lang` attribute, the result is true.
 */
export function isNodeSupportedLanguage(node: Node) {
    const lang = getLangAttribute(node);

    return !(lang && unsupportedLanguages.includes(lang));
}

export function isLoneMustacheTag(node: true | Node[]): node is [MustacheTagNode] {
    return node !== true && node.length === 1 && node[0].type === 'MustacheTag';
}

export function isAttributeShorthand(node: true | Node[]): node is [AttributeShorthandNode] {
    return node !== true && node.length === 1 && node[0].type === 'AttributeShorthand';
}

/**
 * True if node is of type `{a}` or `a={a}`
 */
export function isOrCanBeConvertedToShorthand(node: AttributeNode): boolean {
    if (isAttributeShorthand(node.value)) {
        return true;
    }

    if (isLoneMustacheTag(node.value)) {
        const expression = node.value[0].expression;
        return expression.type === 'Identifier' && expression.name === node.name;
    }

    return false;
}

export function getUnencodedText(node: TextNode) {
    // `raw` will contain HTML entities in unencoded form
    return node.raw || node.data;
}

export function isTextNodeStartingWithLinebreak(node: Node, nrLines = 1): node is TextNode {
    return node.type === 'Text' && startsWithLinebreak(getUnencodedText(node), nrLines);
}

export function startsWithLinebreak(text: string, nrLines = 1): boolean {
    return new RegExp(`^([\\t\\f\\r ]*\\n){${nrLines}}`).test(text);
}

export function isTextNodeEndingWithLinebreak(node: Node, nrLines = 1): node is TextNode {
    return node.type === 'Text' && endsWithLinebreak(getUnencodedText(node), nrLines);
}

export function endsWithLinebreak(text: string, nrLines = 1): boolean {
    return new RegExp(`(\\n[\\t\\f\\r ]*){${nrLines}}$`).test(text);
}

export function isTextNodeStartingWithWhitespace(node: Node): node is TextNode {
    return node.type === 'Text' && /^\s/.test(getUnencodedText(node));
}

export function isTextNodeEndingWithWhitespace(node: Node): node is TextNode {
    return node.type === 'Text' && /\s$/.test(getUnencodedText(node));
}

export function trimTextNodeRight(node: TextNode): void {
    node.raw = node.raw && node.raw.trimRight();
    node.data = node.data && node.data.trimRight();
}

export function trimTextNodeLeft(node: TextNode): void {
    node.raw = node.raw && node.raw.trimLeft();
    node.data = node.data && node.data.trimLeft();
}

/**
 * Remove all leading whitespace up until the first non-empty text node,
 * and all trailing whitepsace from the last non-empty text node onwards.
 */
export function trimChildren(children: Node[], path: FastPath): void {
    let firstNonEmptyNode = children.findIndex(
        (n) => !isEmptyNode(n) && !doesEmbedStartAt(n.end, path),
    );
    firstNonEmptyNode = firstNonEmptyNode === -1 ? children.length - 1 : firstNonEmptyNode;

    let lastNonEmptyNode = findLastIndex(
        (n) => !isEmptyNode(n) && !doesEmbedStartAt(n.end, path),
        children,
    );
    lastNonEmptyNode = lastNonEmptyNode === -1 ? 0 : lastNonEmptyNode;

    for (let i = 0; i <= firstNonEmptyNode; i++) {
        const n = children[i];
        if (n.type === 'Text') {
            trimTextNodeLeft(n);
        }
    }

    for (let i = children.length - 1; i >= lastNonEmptyNode; i--) {
        const n = children[i];
        if (n.type === 'Text') {
            trimTextNodeRight(n);
        }
    }
}
