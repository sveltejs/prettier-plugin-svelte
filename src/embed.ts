import { FastPath, Doc, doc, ParserOptions } from 'prettier';
import { PrintFn } from './print';
import { Node } from './print/nodes';
import { getText } from './lib/getText';
import { isNodeSupportedLanguage, getAttributeTextValue } from './print/node-helpers';
import { snippedTagContentAttribute } from './lib/snipTagContent';

const {
    builders: { concat, hardline, group, indent },
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
        return removeLines(
            textToDoc(getText(node, options), {
                parser: expressionParser,
                singleQuote: true,
            }),
        );
    }

    const embedScript = () =>
        embedTag('script', getEmbedBody(node, 'typescript', textToDoc, options), path, print);

    const embedStyle = () =>
        embedTag('style', getEmbedBody(node, 'css', textToDoc, options), path, print);

    switch (node.type) {
        case 'Script':
            return concat([embedScript(), hardline]);
        case 'Style':
            return concat([embedStyle(), hardline]);
        case 'Element': {
            if (node.name === 'script') {
                return embedScript();
            } else if (node.name === 'style') {
                return embedStyle();
            }
        }
    }

    return null;
}

function expressionParser(text: string, parsers: any) {
    const ast = parsers.babel(`(${text})`);
    return {
        type: 'File',
        program: ast.program.body[0].expression,
    };
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

function newlinesToHardlines(str: string): Doc {
    return concat(
        str.split('\n').reduce((docs, str, i) => {
            return docs.concat(i > 0 ? doc.builders.hardline : []).concat(str !== '' ? str : []);
        }, [] as Doc[]),
    );
}

function getEmbedBody(
    node: Node,
    parser: 'typescript' | 'css',
    textToDoc: (text: string, options: object) => Doc,
    options: ParserOptions,
) {
    const encodedContent = getAttributeTextValue(snippedTagContentAttribute, node);
    let content = '';

    if (encodedContent) {
        content = Buffer.from(encodedContent, 'base64').toString('utf-8');
    }

    if (isNodeSupportedLanguage(node)) {
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
        }
    }

    return newlinesToHardlines(content);
}

function embedTag(tag: string, body: Doc, path: FastPath, print: PrintFn) {
    const attributes = concat(
        path.map(
            (childPath) =>
                childPath.getNode().name !== snippedTagContentAttribute
                    ? childPath.call(print)
                    : '',
            'attributes',
        ),
    );

    return group(concat(['<', tag, indent(group(attributes)), '>', body, '</', tag, '>']));
}
