import { ParserOptions } from 'prettier';
import { Node } from '../print/nodes';

export function getText(node: Node, options: ParserOptions) {
    return options.originalText.slice(options.locStart(node), options.locEnd(node));
}
