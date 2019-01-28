import { FastPath, Doc, doc, ParserOptions } from 'prettier';
import { PrintFn } from './print';
import { Node } from './print/nodes';

const {
    builders: { concat, hardline },
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

    switch (node.type) {
        case 'Program':
            const script = getText(node, options);
            return concat([hardline, nukeLastLine(textToDoc(script, { parser: 'babel' }))]);
        case 'StyleProgram':
            return concat([hardline, nukeLastLine(textToDoc(node.styles, { parser: 'css' }))]);
    }

    return null;
}

function getText(node: Node, options: ParserOptions) {
    return options.originalText.slice(options.locStart(node), options.locEnd(node));
}

function expressionParser(text: string, parsers: any) {
    const ast = parsers.babylon(`(${text})`);
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
