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
    CommentNode,
    SlotTemplateNode,
} from './nodes';
import { blockElements, TagName } from '../lib/elements';
import { FastPath, ParserOptions } from 'prettier';
import { findLastIndex, isASTNode, isPreTagContent } from './helpers';
import { isBracketSameLine } from '../options';

const unsupportedLanguages = ['coffee', 'coffeescript', 'styl', 'stylus', 'sass'];

export function isInlineElement(path: FastPath, options: ParserOptions, node: Node) {
    return (
        node && node.type === 'Element' && !isBlockElement(node, options) && !isPreTagContent(path)
    );
}

export function isBlockElement(node: Node, options: ParserOptions): node is ElementNode {
    return (
        node &&
        node.type === 'Element' &&
        options.htmlWhitespaceSensitivity !== 'strict' &&
        (options.htmlWhitespaceSensitivity === 'ignore' ||
            blockElements.includes(node.name as TagName))
    );
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

export function isNodeWithChildren(node: Node): node is Node & { children: Node[] } {
    return (node as any).children;
}

export function getChildren(node: Node): Node[] {
    return isNodeWithChildren(node) ? node.children : [];
}

/**
 * Returns siblings, that is, the children of the parent.
 */
export function getSiblings(path: FastPath): Node[] {
    let parent: Node = path.getParentNode();

    if (isASTNode(parent)) {
        parent = parent.html;
    }

    return getChildren(parent);
}

/**
 * Returns the previous sibling node.
 */
export function getPreviousNode(path: FastPath): Node | undefined {
    const node: Node = path.getNode();
    return getSiblings(path).find((child) => child.end === node.start);
}

/**
 * Returns the next sibling node.
 */
export function getNextNode(path: FastPath, node: Node = path.getNode()): Node | undefined {
    return getSiblings(path).find((child) => child.start === node.end);
}

/**
 * Returns the comment that is above the current node.
 */
export function getLeadingComment(path: FastPath): CommentNode | undefined {
    const siblings = getSiblings(path);

    let node: Node = path.getNode();
    let prev: Node | undefined = siblings.find((child) => child.end === node.start);
    while (prev) {
        if (
            prev.type === 'Comment' &&
            !isIgnoreStartDirective(prev) &&
            !isIgnoreEndDirective(prev)
        ) {
            return prev;
        } else if (isEmptyTextNode(prev)) {
            node = prev;
            prev = siblings.find((child) => child.end === node.start);
        } else {
            return undefined;
        }
    }
}

/**
 * Did there use to be any embedded object (that has been snipped out of the AST to be moved)
 * at the specified position?
 */
export function doesEmbedStartAfterNode(node: Node, path: FastPath, siblings = getSiblings(path)) {
    // If node is not at the top level of html, an embed cannot start after it,
    // because embeds are only at the top level
    if (!isNodeTopLevelHTML(node, path)) {
        return false;
    }

    const position = node.end;
    const root = path.stack[0];

    const embeds = [root.css, root.html, root.instance, root.js, root.module] as Node[];

    const nextNode = siblings[siblings.indexOf(node) + 1];
    return embeds.find((n) => n && n.start >= position && (!nextNode || n.end <= nextNode.start));
}

export function isNodeTopLevelHTML(node: Node, path: FastPath): boolean {
    const root = path.stack[0];
    return !!root.html && !!root.html.children && root.html.children.includes(node);
}

export function isEmptyTextNode(node: Node | undefined): node is TextNode {
    return !!node && node.type === 'Text' && getUnencodedText(node).trim() === '';
}

export function isIgnoreDirective(node: Node | undefined | null): boolean {
    return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore';
}

export function isIgnoreStartDirective(node: Node | undefined | null): boolean {
    return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore-start';
}

export function isIgnoreEndDirective(node: Node | undefined | null): boolean {
    return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore-end';
}

export function printRaw(
    node:
        | ElementNode
        | InlineComponentNode
        | SlotNode
        | WindowNode
        | HeadNode
        | TitleNode
        | SlotTemplateNode,
    originalText: string,
    stripLeadingAndTrailingNewline: boolean = false,
): string {
    if (node.children.length === 0) {
        return '';
    }

    const firstChild = node.children[0];
    const lastChild = node.children[node.children.length - 1];

    let raw = originalText.substring(firstChild.start, lastChild.end);

    if (!stripLeadingAndTrailingNewline) {
        return raw;
    }

    if (startsWithLinebreak(raw)) {
        raw = raw.substring(raw.indexOf('\n') + 1);
    }
    if (endsWithLinebreak(raw)) {
        raw = raw.substring(0, raw.lastIndexOf('\n'));
        if (raw.charAt(raw.length - 1) === '\r') {
            raw = raw.substring(0, raw.length - 1);
        }
    }

    return raw;
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
 * Checks whether the node contains a `lang` or `type` attribute with a value corresponding to
 * a language we cannot format. This might for example be `<template lang="pug">`.
 * If the node does not contain a `lang` attribute, the result is true.
 */
export function isNodeSupportedLanguage(node: Node) {
    const lang = getLangAttribute(node);

    return !(lang && unsupportedLanguages.includes(lang));
}

/**
 * Checks whether the node contains a `lang` or `type` attribute which indicates that
 * the script contents are written in TypeScript. Note that the absence of the tag
 * does not mean it's not TypeScript, because the user could have set the default
 * to TypeScript in his settings.
 */
export function isTypeScript(node: Node) {
    const lang = getLangAttribute(node) || '';
    return ['typescript', 'ts'].includes(lang);
}

export function isPugTemplate(node: Node): boolean {
    return node.type === 'Element' && node.name === 'template' && getLangAttribute(node) === 'pug';
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
        (n) => !isEmptyTextNode(n) && !doesEmbedStartAfterNode(n, path),
    );
    firstNonEmptyNode = firstNonEmptyNode === -1 ? children.length - 1 : firstNonEmptyNode;

    let lastNonEmptyNode = findLastIndex((n, idx) => {
        // Last node is ok to end at the start of an embedded region,
        // if it's not a comment (which should stick to the region)
        return (
            !isEmptyTextNode(n) &&
            ((idx === children.length - 1 && n.type !== 'Comment') ||
                !doesEmbedStartAfterNode(n, path))
        );
    }, children);
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

/**
 * Check if given node's starg tag should hug its first child. This is the case for inline elements when there's
 * no whitespace between the `>` and the first child.
 */
export function shouldHugStart(
    node: Node,
    isSupportedLanguage: boolean,
    options: ParserOptions,
): boolean {
    if (!isSupportedLanguage) {
        return true;
    }

    if (isBlockElement(node, options)) {
        return false;
    }

    if (!isNodeWithChildren(node)) {
        return false;
    }

    const children: Node[] = node.children;
    if (children.length === 0) {
        return true;
    }

    const firstChild = children[0];
    return !isTextNodeStartingWithWhitespace(firstChild);
}

/**
 * Check if given node's end tag should hug its last child. This is the case for inline elements when there's
 * no whitespace between the last child and the `</`.
 */
export function shouldHugEnd(
    node: Node,
    isSupportedLanguage: boolean,
    options: ParserOptions,
): boolean {
    if (!isSupportedLanguage) {
        return true;
    }

    if (isBlockElement(node, options)) {
        return false;
    }

    if (!isNodeWithChildren(node)) {
        return false;
    }

    const children: Node[] = node.children;
    if (children.length === 0) {
        return true;
    }

    const lastChild = children[children.length - 1];
    return !isTextNodeEndingWithWhitespace(lastChild);
}

/**
 * Check for a svelte block if there's whitespace at the start and if it's a space or a line.
 */
export function checkWhitespaceAtStartOfSvelteBlock(
    node: Node,
    options: ParserOptions,
): 'none' | 'space' | 'line' {
    if (!isSvelteBlock(node) || !isNodeWithChildren(node)) {
        return 'none';
    }

    const children: Node[] = node.children;
    if (children.length === 0) {
        return 'none';
    }

    const firstChild = children[0];

    if (isTextNodeStartingWithLinebreak(firstChild)) {
        return 'line';
    } else if (isTextNodeStartingWithWhitespace(firstChild)) {
        return 'space';
    }

    // This extra check is necessary because the Svelte AST might swallow whitespace between
    // the block's starting end and its first child.
    const parentOpeningEnd = options.originalText.lastIndexOf('}', firstChild.start);
    if (parentOpeningEnd > 0 && firstChild.start > parentOpeningEnd + 1) {
        const textBetween = options.originalText.substring(parentOpeningEnd + 1, firstChild.start);
        if (textBetween.trim() === '') {
            return startsWithLinebreak(textBetween) ? 'line' : 'space';
        }
    }

    return 'none';
}

/**
 * Check for a svelte block if there's whitespace at the end and if it's a space or a line.
 */
export function checkWhitespaceAtEndOfSvelteBlock(
    node: Node,
    options: ParserOptions,
): 'none' | 'space' | 'line' {
    if (!isSvelteBlock(node) || !isNodeWithChildren(node)) {
        return 'none';
    }

    const children: Node[] = node.children;
    if (children.length === 0) {
        return 'none';
    }

    const lastChild = children[children.length - 1];
    if (isTextNodeEndingWithLinebreak(lastChild)) {
        return 'line';
    } else if (isTextNodeEndingWithWhitespace(lastChild)) {
        return 'space';
    }

    // This extra check is necessary because the Svelte AST might swallow whitespace between
    // the last child and the block's ending start.
    const parentClosingStart = options.originalText.indexOf('{', lastChild.end);
    if (parentClosingStart > 0 && lastChild.end < parentClosingStart) {
        const textBetween = options.originalText.substring(lastChild.end, parentClosingStart);
        if (textBetween.trim() === '') {
            return endsWithLinebreak(textBetween) ? 'line' : 'space';
        }
    }

    return 'none';
}

export function isInsideQuotedAttribute(path: FastPath, options: ParserOptions): boolean {
    const stack = path.stack as Node[];

    return stack.some(
        (node) =>
            node.type === 'Attribute' &&
            (!isLoneMustacheTag(node.value) || options.svelteStrictMode),
    );
}

/**
 * Returns true if the softline between `</tagName` and `>` can be omitted.
 */
export function canOmitSoftlineBeforeClosingTag(
    node: Node,
    path: FastPath,
    options: ParserOptions,
): boolean {
    return (
        isBracketSameLine(options) &&
        (!hugsStartOfNextNode(node, options) || isLastChildWithinParentBlockElement(path, options))
    );
}

/**
 * Return true if given node does not hug the next node, meaning there's whitespace
 * or the end of the doc afterwards.
 */
function hugsStartOfNextNode(node: Node, options: ParserOptions): boolean {
    if (node.end === options.originalText.length) {
        // end of document
        return false;
    }

    return !options.originalText.substring(node.end).match(/^\s/);
}

function isLastChildWithinParentBlockElement(path: FastPath, options: ParserOptions): boolean {
    const parent = path.getParentNode() as Node | undefined;
    if (!parent || !isBlockElement(parent, options)) {
        return false;
    }

    const children = getChildren(parent);
    const lastChild = children[children.length - 1];
    return lastChild === path.getNode();
}
