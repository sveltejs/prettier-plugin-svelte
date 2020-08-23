import { Node } from '../src/print/nodes';
import { Doc } from 'prettier';

let nesting = -1;

export function increaseNesting() {
    nesting++;
}

export function decreaseNesting() {
    nesting--;
}

export function debugPrint(s: string) {
    let indent = '';

    for (let i = 0; i < nesting; i++) {
        indent += '    ';
    }

    console.log('\r' + indent + s);
}

export function cloneDoc(doc: Doc): Doc {
    return JSON.parse(JSON.stringify(doc));
}

export function docToString(doc: Doc): string {
    if (typeof doc === 'string') {
        return `"${doc}"`;
    } else if (doc.type === 'line') {
        if (doc.soft) {
            return 'softline';
        } else if (doc.hard) {
            return 'hardline';
        } else {
            return `line${doc.keepIfLonely ? ':keepIfLonely' : ''}`;
        }
    } else {
        const contents = (doc as any).contents;

        const children = contents ? [contents] : (doc as any).parts;

        return doc.type + (children ? `<${children.map(docToString).join(', ')}>` : '');
    }
}

export function nodeToString(node: Node): string {
    if ((node as any).html) {
        return nodeToString((node as any).html);
    }

    const childrenToString = () => (node as any).children.map(nodeToString).join(', ');

    if (node.type === 'Text') {
        return `"${(node.raw || node.data).replace(/\n/g, `\\n`)}"`;
    }

    if (node.type === 'Fragment') {
        return 'frag<' + childrenToString() + '>';
    }

    if (node.type === 'Element') {
        return `<${node.name}>${childrenToString()}</${node.name}>`;
    }

    return node.type;
}
