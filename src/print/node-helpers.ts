import { Node, MustacheTagNode, AttributeShorthandNode, AttributeNode } from './nodes';
import { inlineElements, TagName } from '../lib/elements';

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
