import { ASTNode } from './nodes';

/**
 * Determines whether or not given node
 * is the root of the Svelte AST.
 */
export function isASTNode(n: any): n is ASTNode {
    return n && n.__isRoot;
}
