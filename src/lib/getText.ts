import { ParserOptions } from 'prettier';
import { Node } from '../print/nodes';
import { hasSnippedContent, unsnipContent } from './snipTagContent';

export function getText(node: Node, options: ParserOptions, unsnip = false) {
    const leadingComments: Node[] = (node as any).leadingComments;
    const text = options.originalText.slice(
        options.locStart(
            // if there are comments before the node they are not included
            // in the `start` of the node itself
            (leadingComments && leadingComments[0]) || node,
        ),
        options.locEnd(node),
    );

    if (!unsnip || !hasSnippedContent(text)) {
        return text;
    }

    return unsnipContent(text);
}
