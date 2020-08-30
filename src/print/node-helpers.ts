import { Node, ElementNode, TextNode, AttributeNode } from './nodes';
import { inlineElements, TagName } from '../lib/elements';

const supportedLanguages = [
    'ts',
    'typescript',
    'js',
    'javascript',
    'css',
    'scss',
    'less',
    'postcss',
];

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

export function isEmptyNode(node: Node): boolean {
    return node.type === 'Text' && (node.raw || node.data).trim() === '';
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

export function getLangAttribute(node: Node): string | null {
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

    return !lang || supportedLanguages.includes(lang);
}
