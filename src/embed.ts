import { FastPath, Doc, doc, ParserOptions } from 'prettier';
import { PrintFn } from './print';
import { Node, AttributeNode } from './print/nodes';
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

    console.log(`embed node.type=${node.type} node.isJS=${node.isJS}`);

    if (node.isJS) {
        return removeLines(
            textToDoc(getText(node, options), {
                parser: expressionParser,
                singleQuote: true,
            }),
        );
    }

    switch (node.type) {
        case 'Script':
            return embedTag('script', path, print, textToDoc, node);
        case 'Style':
            return embedTag('style', path, print, textToDoc, node);
        case 'Element': {
            if (node.name === 'script' || node.name === 'style') {
                return embedTag(node.name, path, print, textToDoc, node, true);
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

function embedTag(
    tag: string,
    path: FastPath,
    print: PrintFn,
    textToDoc: (text: string, options: object) => Doc,
    node: Node & { attributes: Node[] },
    inline: boolean = false,
) {
    const parser = tag === 'script' ? 'typescript' : 'css';

    const encodedContent = getAttributeTextValue(snippedTagContentAttribute, node);
    let content = '';

    if (encodedContent) {
        content = Buffer.from(encodedContent, 'base64').toString('utf-8');
    }

    const originalAttributes = node.attributes;

    node.attributes = (node.attributes as AttributeNode[]).filter(
        (n) => n.name !== snippedTagContentAttribute,
    );

    let formatted: Doc = content;

    if (isNodeSupportedLanguage(node)) {
        try {
            formatted = concat([
                indent(concat([hardline, nukeLastLine(textToDoc(content, { parser }))])),
                hardline,
            ]);
        } catch (error) {
            // We will wind up here if there is a syntax error in the embedded code. If we throw an error, 
            // prettier will try to print the node with the printer. That will fail with a hard-to-interpret 
            // error message (e.g. "Unsupported node type", referring to `<script>`).
            // Therefore, fall back on just returning the unformatted text.

            if (process.env.PRETTIER_DEBUG) {
                node.attributes = originalAttributes;

                throw error;
            }

            console.error(error);
        }
    }

    return group(
        concat([
            '<',
            tag,
            indent(group(concat(path.map((childPath) => childPath.call(print), 'attributes')))),
            '>',
            formatted,
            '</',
            tag,
            '>',
            inline ? '' : hardline,
        ]),
    );
}
