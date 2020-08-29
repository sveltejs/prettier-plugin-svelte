import { FastPath, Doc, doc, ParserOptions } from 'prettier';
import { PrintFn } from './print';
import { Node, AttributeNode, TextNode, ElementNode } from './print/nodes';
import { getText } from './lib/getText';

const {
    builders: { concat, hardline, group, indent },
    utils: { removeLines },
} = doc;

const supportedLanguages = ['ts','js', 'css', 'scss']

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
        case 'Script':
            return embedTag('script', path, print, textToDoc, node);
        case 'Style':
            return embedTag('style', path, print, textToDoc, node);
        case 'Element': {
            if (node.name === 'script' || node.name === 'style') {
                return embedTag(node.name, path, print, textToDoc, node, true)
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

function isTextNode(node: Node): node is TextNode {
    return node.type === 'Text'
}

function getLangAttribute(node: Node): string | null {
    const attributes = (node as ElementNode)['attributes'] as AttributeNode[];

    const langAttribute = attributes.find(
        (attribute) => attribute.name === 'lang',
    ) as AttributeNode | null;

    if (langAttribute) {
        const value = langAttribute.value

        const textValue =
            typeof value === 'object' &&
            value.find(isTextNode) ;

        if (textValue && typeof textValue === 'object') {
            return textValue.data;
        }
    }

    return null;
}

function embedTag(
    tag: string,
    path: FastPath,
    print: PrintFn,
    textToDoc: (text: string, options: object) => Doc,
    node: Node & { attributes: Node[] },
    inline: boolean,
) {
    const lang = getLangAttribute(node);

    const isSupportedLanguage = !lang || supportedLanguages.includes(lang);

    const parser = tag === 'script' ? 'typescript' : 'css';
    const contentAttribute = (node.attributes as AttributeNode[]).find(
        (n) => n.name === '✂prettier:content✂',
    );

    let content = '';
    if (
        contentAttribute &&
        Array.isArray(contentAttribute.value) &&
        contentAttribute.value.length > 0
    ) {
        const encodedContent = (contentAttribute.value[0] as TextNode).data;
        content = Buffer.from(encodedContent, 'base64').toString('utf-8');
    }
    node.attributes = node.attributes.filter((n) => n !== contentAttribute);

    return group(
        concat([
            '<',
            tag,
            indent(group(concat(path.map((childPath) => childPath.call(print), 'attributes')))),
            '>',
            isSupportedLanguage
                ? concat([
                      indent(concat([hardline, nukeLastLine(textToDoc(content, { parser }))])),
                      hardline,
                  ])
                : content,
            '</',
            tag,
            '>',
            inline ? '' : hardline,
        ]),
    );
}
