import { Node } from './nodes';
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

          return text === '' || text.trim() !== '';
      case 'MustacheTag':
          return true;
      default:
          return false;
  }
}

export function isEmptyNode(node: Node): boolean {
  return node.type === 'Text' && (node.raw || node.data).trim() === '';
}
