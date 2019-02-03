import { Node, ScriptNode, InstanceScriptNode, ModuleScriptNode } from './nodes';

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
