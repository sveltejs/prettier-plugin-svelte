import { Doc, doc, FastPath, ParserOptions } from 'prettier';
import { getText } from './lib/getText';
import { snippedTagContentAttribute } from './lib/snipTagContent';
import { PrintFn } from './print';
import {
    getAttributeTextValue,
    isNodeSupportedLanguage,
    isIgnoreDirective,
    getPreviousNode,
} from './print/node-helpers';
import { Node } from './print/nodes';

const {
    builders: { concat, hardline, group, indent, literalline },
    utils: { removeLines },
} = doc;

export function embed(
    path: FastPath,
    print: PrintFn,
    textToDoc: (text: string, options: object) => Doc,
    options: ParserOptions,
): Doc | null {
    const node: Node = path.getNode();

    if (node.isJS) {
        try {
            return removeLines(
                textToDoc(forceIntoExpression(getText(node, options)), {
                    parser: expressionParser,
                    singleQuote: true,
                }),
            );
        } catch (e) {
            return getText(node, options);
        }
    }

    const embedType = (tag: string, parser: 'typescript' | 'css', isTopLevel: boolean) =>
        embedTag(
            tag,
            path,
            (content) => formatBodyContent(content, parser, textToDoc, options),
            print,
            isTopLevel,
        );

    const embedScript = (isTopLevel: boolean) => embedType('script', 'typescript', isTopLevel);
    const embedStyle = (isTopLevel: boolean) => embedType('style', 'css', isTopLevel);

    switch (node.type) {
        case 'Script':
            return embedScript(true);
        case 'Style':
            return embedStyle(true);
        case 'Element': {
            if (node.name === 'script') {
                return embedScript(false);
            } else if (node.name === 'style') {
                return embedStyle(false);
            }
        }
    }

    return null;
}

function forceIntoExpression(statement: string) {
    // note the trailing newline: if the statement ends in a // comment,
    // we can't add the closing bracket right afterwards
    return `(${statement}\n)`;
}

function expressionParser(text: string, parsers: any) {
    const ast = parsers.babel(text);

    return { ...ast, program: ast.program.body[0].expression };
}

function skipBlank(docs: Doc[]): number {
    for (let i = docs.length - 1; i >= 0; i--) {
        const doc = docs[i];
        if (typeof doc !== 'string') {
            if (doc.type === 'break-parent') {
                continue;
            }
        }

        return i;
    }

    return -1;
}

function nukeLastLine(doc: Doc): Doc {
    if (typeof doc === 'string') {
        return doc;
    }

    switch (doc.type) {
        case 'concat':
            const end = skipBlank(doc.parts);
            if (end > -1) {
                return concat([
                    ...doc.parts.slice(0, end),
                    nukeLastLine(doc.parts[end]),
                    ...doc.parts.slice(end + 1),
                ]);
            }
            break;
        case 'line':
            return '';
    }

    return doc;
}

function preformattedBody(str: string): Doc {
    const firstNewline = /^[\t\f\r ]*\n/;
    const lastNewline = /\n[\t\f\r ]*$/;

    // If we do not start with a new line prettier might try to break the opening tag
    // to keep it together with the string. Use a literal line to skip indentation.
    return concat([literalline, str.replace(firstNewline, '').replace(lastNewline, ''), hardline]);
}

function getSnippedContent(node: Node) {
    const encodedContent = getAttributeTextValue(snippedTagContentAttribute, node);

    if (encodedContent) {
        return Buffer.from(encodedContent, 'base64').toString('utf-8');
    } else {
        return '';
    }
}

function formatBodyContent(
    content: string,
    parser: 'typescript' | 'css',
    textToDoc: (text: string, options: object) => Doc,
    options: ParserOptions,
) {
    const indentContent = options.svelteIndentScriptAndStyle;

    try {
        const indentIfDesired = (doc: Doc) => (indentContent ? indent(doc) : doc);

        return concat([
            indentIfDesired(concat([hardline, nukeLastLine(textToDoc(content, { parser }))])),
            hardline,
        ]);
    } catch (error) {
        if (process.env.PRETTIER_DEBUG) {
            throw error;
        }

        // We will wind up here if there is a syntax error in the embedded code. If we throw an error,
        // prettier will try to print the node with the printer. That will fail with a hard-to-interpret
        // error message (e.g. "Unsupported node type", referring to `<script>`).
        // Therefore, fall back on just returning the unformatted text.
        console.error(error);

        return preformattedBody(content);
    }
}

function embedTag(
    tag: string,
    path: FastPath,
    formatBodyContent: (content: string) => Doc,
    print: PrintFn,
    isTopLevel: boolean,
) {
    const node: Node = path.getNode();
    const content = getSnippedContent(node);

    const previousNode = getPreviousNode(path);
    const previousComment = previousNode && previousNode.type === 'Comment' ? previousNode : null;

    const body: Doc =
        isNodeSupportedLanguage(node) && !isIgnoreDirective(previousComment)
            ? content.trim() !== ''
                ? formatBodyContent(content)
                : hardline
            : preformattedBody(content);

    const attributes = concat(
        path.map(
            (childPath) =>
                childPath.getNode().name !== snippedTagContentAttribute
                    ? childPath.call(print)
                    : '',
            'attributes',
        ),
    );

    let result: Doc = group(
        concat(['<', tag, indent(group(attributes)), '>', body, '</', tag, '>']),
    );

    if (isTopLevel) {
        // top level embedded nodes have been moved from their normal position in the
        // node tree. if there is a comment referring to it, it must be recreated at
        // the new position.
        if (previousComment) {
            result = concat(['<!--', previousComment.data, '-->', hardline, result, hardline]);
        } else {
            result = concat([result, hardline]);
        }
    }

    return result;
}
