import { ParserOptions } from '../options';
import { Node } from '../print/nodes';
import { hasSnippedContent, unsnipContent } from './snipTagContent';

export function getText(node: Node, options: ParserOptions, unsnip = false) {
    const leadingComments: Node[] = (node as any).leadingComments;
    const text =
        options.originalText.slice(
            options.locStart(
                // if there are comments before the node they are not included
                // in the `start` of the node itself
                (leadingComments && leadingComments[0]) || node,
            ),
            options.locEnd(node),
        ) + getClosingParens(node, leadingComments, options);

    if (!unsnip || !hasSnippedContent(text)) {
        return text;
    }

    return unsnipContent(text);
}

/**
 * When a leading comment comes before a `(` of the expression, the text from the comment
 * to the end of the node has the `(` but not its `)`. Return the missing `)`.
 * Comments between the node and the `)` are left out, like other trailing comments.
 */
function getClosingParens(node: Node, leadingComments: Node[] | undefined, options: ParserOptions) {
    if (!leadingComments || leadingComments.length === 0) {
        return '';
    }

    const text = options.originalText;
    let openParens = 0;
    for (let i = 0; i < leadingComments.length; i++) {
        const gap = text.slice(
            options.locEnd(leadingComments[i]),
            i + 1 < leadingComments.length
                ? options.locStart(leadingComments[i + 1])
                : options.locStart(node),
        );
        for (const char of gap) {
            if (char === '(') openParens++;
        }
    }

    let closingParens = '';
    let index: number = options.locEnd(node);
    while (openParens > 0) {
        index = skipWhitespaceAndComments(text, index);
        if (text[index] !== ')') break;
        index++;
        closingParens += ')';
        openParens--;
    }
    return closingParens;
}

function skipWhitespaceAndComments(text: string, index: number) {
    while (index < text.length) {
        if (/\s/.test(text[index])) {
            index++;
        } else if (text.startsWith('/*', index)) {
            const commentEnd = text.indexOf('*/', index + 2);
            if (commentEnd === -1) return index;
            index = commentEnd + 2;
        } else if (text.startsWith('//', index)) {
            const lineEnd = text.slice(index).search(/[\n\r\u2028\u2029]/);
            if (lineEnd === -1) return index;
            index += lineEnd;
        } else {
            break;
        }
    }
    return index;
}
