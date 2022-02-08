import { ParserOptions } from 'prettier';
import { Node } from '../print/nodes';

export function getText(node: Node, options: ParserOptions) {
    const leadingComments: Node[] = (node as any).leadingComments;

    return options.originalText.slice(
        options.locStart(
            // if there are comments before the node they are not included
            // in the `start` of the node itself
            (leadingComments && leadingComments[0]) || node,
        ),
        options.locEnd(node),
    );
}
