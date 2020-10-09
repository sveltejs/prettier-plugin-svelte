import {
    Node,
    ElementNode,
    TextNode,
    AttributeNode,
    MustacheTagNode,
    AttributeShorthandNode,
} from './nodes';
import { inlineElements, TagName } from '../lib/elements';
import { FastPath } from 'prettier';
import { isASTNode } from './helpers';

const unsupportedLanguages = ['coffee', 'coffeescript', 'pug', 'styl', 'stylus', 'sass'];

export function isInlineElement(node: Node) {
    return node.type === 'Element' && inlineElements.includes(node.name as TagName);
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
            const text = node.raw || node.data;
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
 * Returns the next sibling node.
 */
export function getNextNode(path: FastPath): Node | undefined {
    const node: Node = path.getNode();
    let parent: Node = path.getParentNode();

    if (isASTNode(parent)) {
        parent = parent.html;
    }

    return getChildren(parent).find((child) => child.start === node.end);
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

export function isEmptyNode(node: Node): boolean {
    return node.type === 'Text' && (node.raw || node.data).trim() === '';
}

export function isIgnoreDirective(node: Node | undefined | null): boolean {
    return !!node && node.type === 'Comment' && node.data.trim() === 'prettier-ignore';
}

export function printRaw(node: Node): string {
    const children: Node[] | undefined = (node as ElementNode).children;

    if (children) {
        return children.map(printRaw).join('');
    } else {
        return (node as TextNode).raw || '';
    }
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
    const value = getAttributeTextValue('lang', node);

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
