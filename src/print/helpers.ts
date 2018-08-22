import { Node } from './nodes';

export interface ASTNode {
    html: Node;
    css: Node & {
        attributes: Node[];
        children: Node[];
        content: Node & {
            styles: string;
        };
    };
    js: Node & {
        attributes: Node[];
        content: Node;
    };
}

export function isASTNode(n: any): n is ASTNode {
    return 'html' in n && 'css' in n && 'js' in n;
}
