import { ASTNode, Node } from './nodes';
import { FastPath } from 'prettier';
import { formattableAttributes } from '../lib/elements';

/**
 * Determines whether or not given node
 * is the root of the Svelte AST.
 */
export function isASTNode(n: any): n is ASTNode {
    return n && n.__isRoot;
}

export function isPreTagContent(path: FastPath): boolean {
    const stack = path.stack as Node[];

    return stack.some(
        (node) =>
            (node.type === 'Element' && node.name.toLowerCase() === 'pre') ||
            (node.type === 'Attribute' && !formattableAttributes.includes(node.name)),
    );
}

export function flatten<T>(arrays: T[][]): T[] {
    return ([] as T[]).concat.apply([], arrays);
}

export function findLastIndex<T>(isMatch: (item: T) => boolean, items: T[]) {
    for (let i = items.length - 1; i >= 0; i--) {
        if (isMatch(items[i])) {
            return i;
        }
    }

    return -1;
}
