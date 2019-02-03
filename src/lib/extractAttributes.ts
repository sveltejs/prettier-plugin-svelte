import { AttributeNode, TextNode } from '../print/nodes';

export function extractAttributes(html: string): AttributeNode[] {
    const extractAttributesRegex = /<[a-z]+\s*(.*?)>/i;
    const attributeRegex = /([^\s=]+)(?:=("|')(.*?)\2)?/gi;

    const [, attributesString] = html.match(extractAttributesRegex)!;

    const attrs: AttributeNode[] = [];

    let match: RegExpMatchArray | null;
    while ((match = attributeRegex.exec(attributesString))) {
        const [all, name, quotes, value] = match;
        const attrStart = match.index!;

        let valueNode: AttributeNode['value'];
        if (!value) {
            valueNode = true;
        } else {
            let valueStart = attrStart + name.length;
            if (quotes) {
                valueStart += 2;
            }

            valueNode = [
                {
                    type: 'Text',
                    data: value,
                    start: valueStart,
                    end: valueStart + value.length,
                } as TextNode,
            ];
        }

        attrs.push({
            type: 'Attribute',
            name,
            value: valueNode,
            start: attrStart,
            end: attrStart + all.length,
        });
    }

    return attrs;
}
