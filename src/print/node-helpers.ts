import {
    Attribute,
    AwaitBlock,
    Block,
    Comment,
    CommentInfo,
    Component,
    Css,
    EachBlock,
    ElementLike,
    ExpressionTag,
    Fragment,
    IfBlock,
    KeyBlock,
    RegularElement,
    Root,
    Script,
    SlotElement,
    SnippetBlock,
    StyleDirective,
    SvelteComponent,
    SvelteElement,
    SvelteFragment,
    SvelteHead,
    SvelteNode,
    SvelteOptions,
    SvelteSelf,
    SvelteWindow,
    Tag,
    Text,
    TitleElement,
} from './nodes';
import { blockElements, TagName } from '../lib/elements';
import { AstPath } from 'prettier';
import { findLastIndex, isPreTagContent } from './helpers';
import { ParserOptions, isBracketSameLine } from '../options';

const unsupportedLanguages = ['coffee', 'coffeescript', 'styl', 'stylus', 'sass'];

export function isInlineElement(path: AstPath, options: ParserOptions, node: SvelteNode) {
    return (
        node &&
        node.type === 'RegularElement' &&
        !isBlockElement(node, options) &&
        !isPreTagContent(path)
    );
}

export function isBlockElement(node: SvelteNode, options: ParserOptions): node is RegularElement {
    return (
        node &&
        node.type === 'RegularElement' &&
        options.htmlWhitespaceSensitivity !== 'strict' &&
        (options.htmlWhitespaceSensitivity === 'ignore' ||
            blockElements.includes(node.name as TagName))
    );
}

export function isSvelteBlock(
    node: SvelteNode,
): node is IfBlock | SnippetBlock | AwaitBlock | EachBlock | KeyBlock {
    return ['IfBlock', 'SnippetBlock', 'AwaitBlock', 'EachBlock', 'KeyBlock'].includes(node.type);
}

export function isNodeWithChildren(node: SvelteNode): node is SvelteNode & { fragment: Fragment } {
    return (node as any).fragment?.type === 'Fragment';
}

export function getChildren(node: SvelteNode): Array<Text | Tag | ElementLike | Block | Comment> {
    return isNodeWithChildren(node) ? node.fragment.nodes : [];
}

/**
 * Returns siblings, that is, the children of the parent.
 */
export function getSiblings(path: AstPath): SvelteNode[] {
    let parent: SvelteNode = path.getParentNode();

    if (parent.type === 'Fragment') return parent.nodes;

    return getChildren(parent);
}

/**
 * Returns the next sibling node.
 */
export function getNextNode(path: AstPath): SvelteNode | undefined {
    const node: SvelteNode = path.getNode();

    return getSiblings(path).find((child) => child.start === node.end);
}

/**
 * Returns the comment that is above the current node.
 */
export function getLeadingComment(path: AstPath): Comment | undefined {
    const siblings = getSiblings(path);

    let node: SvelteNode = path.getNode();
    let prev: SvelteNode | undefined = siblings.find((child) => child.end === node.start);
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
export function doesEmbedStartAfterNode(node: SvelteNode, path: AstPath) {
    // If node is not at the top level of html, an embed cannot start after it,
    // because embeds are only at the top level
    if (!isNodeTopLevelHTML(node, path)) {
        return false;
    }

    const position = node.end;
    const root = path.stack[0] as Root;

    const embeds = [
        root.css,
        root.fragment,
        root.instance,
        root.module,
        root.options,
    ] as SvelteNode[];
    const siblings = getSiblings(path);
    const nextNode = siblings[siblings.indexOf(node) + 1];
    return embeds.find((n) => n && n.start >= position && (!nextNode || n.end <= nextNode.start));
}

export function isNodeTopLevelHTML(node: SvelteNode, path: AstPath): boolean {
    const root = path.stack[0] as Root | undefined;
    return !!root && root.fragment.nodes.includes(node);
}

export function isEmptyTextNode(node: SvelteNode | undefined): node is Text {
    return !!node && node.type === 'Text' && getUnencodedText(node).trim() === '';
}

export function isIgnoreDirective(node: SvelteNode | undefined | null): boolean {
    return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore';
}

export function isIgnoreStartDirective(node: SvelteNode | undefined | null): boolean {
    return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore-start';
}

export function isIgnoreEndDirective(node: SvelteNode | undefined | null): boolean {
    return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore-end';
}

export function printRaw(
    node:
        | RegularElement
        | SvelteElement
        | SvelteSelf
        | SvelteComponent
        | Component
        | SlotElement
        | SvelteWindow
        | SvelteHead
        | TitleElement
        | SvelteFragment,
    originalText: string,
    stripLeadingAndTrailingNewline: boolean = false,
): string {
    if (node.fragment.nodes.length === 0) {
        return '';
    }

    const firstChild = node.fragment.nodes[0];
    const lastChild = node.fragment.nodes[node.fragment.nodes.length - 1];

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

function isTextNode(node: SvelteNode): node is Text {
    return node.type === 'Text';
}

function getAttributeValue(attributeName: string, node: SvelteNode) {
    const attributes = (node as RegularElement).attributes ?? [];

    const langAttribute = attributes.find((attribute) => attribute.name === attributeName);

    return langAttribute && langAttribute.value;
}

export function getAttributeTextValue(attributeName: string, node: SvelteNode): string | null {
    const value = getAttributeValue(attributeName, node);

    if (value != null && typeof value === 'object') {
        const textValue = value.find(isTextNode);

        if (textValue) {
            return textValue.data;
        }
    }

    return null;
}

function getLangAttribute(node: SvelteNode): string | null {
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
export function isNodeSupportedLanguage(node: SvelteNode) {
    const lang = getLangAttribute(node);

    return !(lang && unsupportedLanguages.includes(lang));
}

/**
 * Checks whether the node contains a `lang` or `type` attribute which indicates that
 * the script contents are written in TypeScript. Note that the absence of the tag
 * does not mean it's not TypeScript, because the user could have set the default
 * to TypeScript in his settings.
 */
export function isTypeScript(node: SvelteNode) {
    const lang = getLangAttribute(node) || '';
    return ['typescript', 'ts'].includes(lang);
}

export function isJSON(node: SvelteNode) {
    const lang = getLangAttribute(node) || '';
    // https://github.com/prettier/prettier/pull/6293
    return lang.endsWith('json') || lang.endsWith('importmap');
}

export function isLess(node: SvelteNode) {
    const lang = getLangAttribute(node) || '';
    return ['less'].includes(lang);
}

export function isScss(node: SvelteNode) {
    const lang = getLangAttribute(node) || '';
    return ['sass', 'scss'].includes(lang);
}

export function isPugTemplate(node: SvelteNode): boolean {
    return (
        node.type === 'RegularElement' &&
        node.name === 'template' &&
        getLangAttribute(node) === 'pug'
    );
}

export function isLoneExpressionTag(node: true | SvelteNode[]): node is [ExpressionTag] {
    return node !== true && node.length === 1 && node[0].type === 'ExpressionTag';
}

//todo
export function isAttributeShorthand(node: true | SvelteNode[]): node is [AttributeShorthand] {
    return node !== true && node.length === 1 && node[0].type === 'AttributeShorthand';
}

/**
 * True if node is of type `{a}` or `a={a}`
 */
export function isOrCanBeConvertedToShorthand(node: Attribute | StyleDirective): boolean {
    if (isAttributeShorthand(node.value)) {
        return true;
    }

    if (isLoneExpressionTag(node.value)) {
        const expression = node.value[0].expression;
        return expression.type === 'Identifier' && expression.name === node.name;
    }

    return false;
}

export function getUnencodedText(node: Text) {
    // `raw` will contain HTML entities in unencoded form
    return node.raw || node.data;
}

export function isTextNodeStartingWithLinebreak(node: SvelteNode, nrLines = 1): node is Text {
    return node.type === 'Text' && startsWithLinebreak(getUnencodedText(node), nrLines);
}

export function startsWithLinebreak(text: string, nrLines = 1): boolean {
    return new RegExp(`^([\\t\\f\\r ]*\\n){${nrLines}}`).test(text);
}

export function isTextNodeEndingWithLinebreak(node: SvelteNode, nrLines = 1): node is Text {
    return node.type === 'Text' && endsWithLinebreak(getUnencodedText(node), nrLines);
}

export function endsWithLinebreak(text: string, nrLines = 1): boolean {
    return new RegExp(`(\\n[\\t\\f\\r ]*){${nrLines}}$`).test(text);
}

export function isTextNodeStartingWithWhitespace(node: SvelteNode): node is Text {
    return node.type === 'Text' && /^\s/.test(getUnencodedText(node));
}

export function isTextNodeEndingWithWhitespace(node: SvelteNode): node is Text {
    return node.type === 'Text' && /\s$/.test(getUnencodedText(node));
}

export function trimTextNodeRight(node: Text): void {
    node.raw = node.raw && node.raw.trimRight();
    node.data = node.data && node.data.trimRight();
}

export function trimTextNodeLeft(node: Text): void {
    node.raw = node.raw && node.raw.trimLeft();
    node.data = node.data && node.data.trimLeft();
}

/**
 * Remove all leading whitespace up until the first non-empty text node,
 * and all trailing whitespace from the last non-empty text node onwards.
 */
export function trimChildren(children: SvelteNode[], path: AstPath): void {
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
 * Check if given node's start tag should hug its first child. This is the case for inline elements when there's
 * no whitespace between the `>` and the first child.
 */
export function shouldHugStart(
    node: SvelteNode,
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

    const children: SvelteNode[] = node.fragment.nodes;
    if (children.length === 0) {
        return true;
    }

    if (options.htmlWhitespaceSensitivity === 'ignore') {
        return false;
    }

    const firstChild = children[0];
    return !isTextNodeStartingWithWhitespace(firstChild);
}

/**
 * Check if given node's end tag should hug its last child. This is the case for inline elements when there's
 * no whitespace between the last child and the `</`.
 */
export function shouldHugEnd(
    node: SvelteNode,
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

    const children: SvelteNode[] = node.fragment.nodes;
    if (children.length === 0) {
        return true;
    }

    if (options.htmlWhitespaceSensitivity === 'ignore') {
        return false;
    }

    const lastChild = children[children.length - 1];
    return !isTextNodeEndingWithWhitespace(lastChild);
}

/**
 * Check for a fragment if there's whitespace at the start and if it's a space or a line.
 */
export function checkWhitespaceAtStartOfFragment(node: Fragment): 'none' | 'space' | 'line' {
    const children = node.nodes;
    if (children.length === 0) {
        return 'none';
    }

    const firstChild = children[0];

    if (isTextNodeStartingWithLinebreak(firstChild)) {
        return 'line';
    } else if (isTextNodeStartingWithWhitespace(firstChild)) {
        return 'space';
    }

    return 'none';
}

/**
 * Check for a fragment if there's whitespace at the end and if it's a space or a line.
 */
export function checkWhitespaceAtEndOfFragment(node: Fragment): 'none' | 'space' | 'line' {
    const children = node.nodes;
    if (children.length === 0) {
        return 'none';
    }

    const lastChild = children[children.length - 1];
    if (isTextNodeEndingWithLinebreak(lastChild)) {
        return 'line';
    } else if (isTextNodeEndingWithWhitespace(lastChild)) {
        return 'space';
    }

    return 'none';
}

export function isInsideQuotedAttribute(path: AstPath, options: ParserOptions): boolean {
    const stack = path.stack as SvelteNode[];

    return stack.some((node) => node.type === 'Attribute' && !isLoneExpressionTag(node.value));
}

/**
 * Returns true if the softline between `</tagName` and `>` can be omitted.
 */
export function canOmitSoftlineBeforeClosingTag(
    node: ElementLike,
    path: AstPath,
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
function hugsStartOfNextNode(node: ElementLike, options: ParserOptions): boolean {
    if (node.end === options.originalText.length) {
        // end of document
        return false;
    }

    return !options.originalText.substring(node.end).match(/^\s/);
}

function isLastChildWithinParentBlockElement(path: AstPath, options: ParserOptions): boolean {
    const parent = path.getParentNode() as SvelteNode | undefined;
    if (!parent || !isBlockElement(parent, options)) {
        return false;
    }

    const children = getChildren(parent);
    const lastChild = children[children.length - 1];
    return lastChild === path.getNode();
}

export function assignCommentsToNodes(ast: Root) {
    if (ast.options) {
        // @ts-expect-error
        ast.options.comments = removeAndGetLeadingComments(ast, ast.options);
    }
    if (ast.module) {
        // @ts-expect-error
        ast.module.comments = removeAndGetLeadingComments(ast, ast.module);
    }
    if (ast.instance) {
        // @ts-expect-error
        ast.instance.comments = removeAndGetLeadingComments(ast, ast.instance);
    }
    if (ast.css) {
        // @ts-expect-error
        ast.css.comments = removeAndGetLeadingComments(ast, ast.css);
    }
}

/**
 * Returns the comments that are above the current node and deletes them from the html ast.
 */
function removeAndGetLeadingComments(
    ast: Root,
    current: SvelteOptions | Script | Css.StyleSheet
): CommentInfo[] {
    const siblings = getChildren(ast);
    const comments: Comment[] = [];
    const newlines: Text[] = [];

    if (!siblings.length) {
        return [];
    }

    let node = current;
    let prev = siblings.find((child) => child.end === node.start);
    while (prev) {
        if (
            prev.type === 'Comment' &&
            !isIgnoreStartDirective(prev) &&
            !isIgnoreEndDirective(prev)
        ) {
            comments.push(prev);
            if (comments.length !== newlines.length) {
                newlines.push({ type: 'Text', data: '', raw: '', start: -1, end: -1 });
            }
        } else if (isEmptyTextNode(prev)) {
            newlines.push(prev);
        } else {
            break;
        }

        node = prev;
        prev = siblings.find((child) => child.end === node.start);
    }

    newlines.length = comments.length; // could be one more if first comment is preceeded by empty text node

    for (const comment of comments) {
        siblings.splice(siblings.indexOf(comment), 1);
    }

    for (const text of newlines) {
        siblings.splice(siblings.indexOf(text), 1);
    }

    return comments
        .map((comment, i) => ({
            comment,
            emptyLineAfter: getUnencodedText(newlines[i]).split('\n').length > 2,
        }))
        .reverse();
}
