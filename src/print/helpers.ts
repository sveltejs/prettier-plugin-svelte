import { Node, ScriptNode } from './nodes';
import { FastPath } from 'prettier';

export interface ASTNode {
    html: Node;
    css?: Node & {
        attributes: Node[];
        children: Node[];
        content: Node & {
            styles: string;
        };
    };
    js?: ScriptNode;
    instance?: ScriptNode;
    module?: ScriptNode;
}

export function isASTNode(n: any): n is ASTNode {
    return 'html' in n && 'tokens' in n;
}

export function isPreTagContent(path: FastPath): boolean {
    const stack = path.stack as Node[];
    return stack.some(node => node.type === 'Element' && node.name.toLowerCase() === 'pre');
}