import { Doc, doc } from 'prettier';
import { findLastIndex } from './helpers';

/**
 * Check if doc is a hardline.
 * We can't just rely on a simple equality check because the doc could be created with another
 * runtime version of prettier than what we import, making a reference check fail.
 */
export function isHardline(docToCheck: Doc): boolean {
    return docToCheck === doc.builders.hardline || deepEqual(docToCheck, doc.builders.hardline);
}

/**
 * Simple deep equal function which suits our needs. Only works properly on POJOs without cyclic deps.
 */
function deepEqual(x: any, y: any): boolean {
    if (x === y) {
        return true;
    } else if (typeof x == 'object' && x != null && typeof y == 'object' && y != null) {
        if (Object.keys(x).length != Object.keys(y).length) return false;

        for (var prop in x) {
            if (y.hasOwnProperty(prop)) {
                if (!deepEqual(x[prop], y[prop])) return false;
            } else {
                return false;
            }
        }

        return true;
    } else {
        return false;
    }
}

function isDocCommand(doc: Doc): doc is doc.builders.DocCommand {
    return typeof doc === 'object' && doc !== null;
}

export function isLine(docToCheck: Doc): boolean {
    return (
        isHardline(docToCheck) ||
        (isDocCommand(docToCheck) && docToCheck.type === 'line') ||
        (Array.isArray(docToCheck) && docToCheck.every(isLine))
    );
}

/**
 * Check if the doc is empty, i.e. consists of nothing more than empty strings (possibly nested).
 */
export function isEmptyDoc(doc: Doc): boolean {
    if (typeof doc === 'string') {
        return doc.length === 0;
    }

    if (isDocCommand(doc) && doc.type === 'line') {
        return !doc.keepIfLonely;
    }

    if (Array.isArray(doc)) {
        return doc.length === 0;
    }

    const { contents } = doc as { contents?: Doc };

    if (contents) {
        return isEmptyDoc(contents);
    }

    const { parts } = doc as { parts?: Doc[] };

    if (parts) {
        return isEmptyGroup(parts);
    }

    return false;
}

export function isEmptyGroup(group: Doc[]): boolean {
    return !group.find((doc) => !isEmptyDoc(doc));
}

/**
 * Trims both leading and trailing nodes matching `isWhitespace` independent of nesting level
 * (though all trimmed adjacent nodes need to be a the same level). Modifies the `docs` array.
 */
export function trim(docs: Doc[], isWhitespace: (doc: Doc) => boolean): Doc[] {
    trimLeft(docs, isWhitespace);
    trimRight(docs, isWhitespace);

    return docs;
}

/**
 * Trims the leading nodes matching `isWhitespace` independent of nesting level (though all nodes need to be a the same level).
 * If there are empty docs before the first whitespace, they are removed, too.
 */
export function trimLeft(group: Doc[], isWhitespace: (doc: Doc) => boolean): void {
    let firstNonWhitespace = group.findIndex((doc) => !isEmptyDoc(doc) && !isWhitespace(doc));

    if (firstNonWhitespace < 0 && group.length) {
        firstNonWhitespace = group.length;
    }

    if (firstNonWhitespace > 0) {
        const removed = group.splice(0, firstNonWhitespace);
        if (removed.every(isEmptyDoc)) {
            return trimLeft(group, isWhitespace);
        }
    } else {
        const parts = getParts(group[0]);

        if (parts) {
            return trimLeft(parts, isWhitespace);
        }
    }
}

/**
 * Trims the trailing nodes matching `isWhitespace` independent of nesting level (though all nodes need to be a the same level).
 * If there are empty docs after the last whitespace, they are removed, too.
 */
export function trimRight(group: Doc[], isWhitespace: (doc: Doc) => boolean): void {
    let lastNonWhitespace = group.length
        ? findLastIndex((doc) => !isEmptyDoc(doc) && !isWhitespace(doc), group)
        : 0;

    if (lastNonWhitespace < group.length - 1) {
        const removed = group.splice(lastNonWhitespace + 1);
        if (removed.every(isEmptyDoc)) {
            return trimRight(group, isWhitespace);
        }
    } else {
        const parts = getParts(group[group.length - 1]);

        if (parts) {
            return trimRight(parts, isWhitespace);
        }
    }
}

function getParts(doc: Doc): Doc[] | undefined {
    if (typeof doc === 'object') {
        if (Array.isArray(doc)) {
            return doc;
        }
        if (doc.type === 'fill') {
            return doc.parts;
        }
        if (doc.type === 'group') {
            return getParts(doc.contents);
        }
    }
}

/**
 * Remove leading semicolons added by Prettier for ASI protection
 */
export function removeLeadingSemicolon(doc: Doc): Doc {
    // Handle string docs
    if (typeof doc === 'string') {
        let str = doc;
        // Remove leading semicolon (ASI protection added by Prettier)
        while (str.startsWith(';')) {
            str = str.slice(1);
        }
        return str;
    }
    
    // Handle array docs
    if (Array.isArray(doc)) {
        const result = [...doc];
        // Remove leading semicolons from the first element
        while (result.length > 0 && typeof result[0] === 'string' && result[0].startsWith(';')) {
            result[0] = result[0].slice(1);
            if (result[0] === '') {
                result.shift();
            }
        }
        return result;
    }
    
    // For other doc types, return as-is
    return doc;
}

/**
 * `(foo = bar)` => `foo = bar`
 * Also removes leading semicolons added by Prettier for ASI protection
 */
export function removeParentheses(doc: Doc): Doc {
    // Handle string docs that have semicolons and/or parentheses
    if (typeof doc === 'string') {
        let str = doc;
        // Remove leading semicolon (ASI protection added by Prettier)
        while (str.startsWith(';')) {
            str = str.slice(1);
        }
        // For simple expressions, Prettier keeps wrapping parentheses even with semi:false
        // e.g., ('foo') stays as ('foo'). We need to remove these for single expressions.
        // We use a very conservative heuristic: only remove if it starts with '(', ends with ')',
        // and has no other parentheses anywhere inside. This ensures we only remove wrapping
        // from simple literals and avoid touching expressions like function calls or grouping.
        // Note: This is intentionally conservative to avoid removing semantically important
        // parentheses. It means some unnecessary wrapping may remain, which is acceptable.
        if (str.startsWith('(') && str.endsWith(')')) {
            const hasNoInnerParens = str.indexOf('(', 1) === -1 && str.indexOf(')', str.length - 2) === str.length - 1;
            if (hasNoInnerParens) {
                // Only one set of parentheses wrapping the whole thing
                str = str.slice(1, -1);
            }
        }
        return str;
    }
    
    // Handle array docs
    if (Array.isArray(doc)) {
        const result = [...doc];
        // Remove leading semicolons from the first element
        while (result.length > 0 && typeof result[0] === 'string' && result[0].startsWith(';')) {
            result[0] = result[0].slice(1);
            if (result[0] === '') {
                result.shift();
            }
        }
        
        // If the result is a single string, handle it recursively
        // Only recurse if we actually made a change (removed semicolons) to avoid infinite recursion
        if (result.length === 1 && typeof result[0] === 'string') {
            const originalFirstElement = Array.isArray(doc) ? doc[0] : doc;
            const wasChanged = result[0] !== originalFirstElement;
            if (wasChanged) {
                return removeParentheses(result[0]);
            }
            return result[0];
        }
        
        // For multi-element arrays, just return after removing leading semicolons
        // Don't try to remove parentheses as they might be part of the expression structure
        // (e.g., function call parentheses, not wrapping from forceIntoExpression)
        return result;
    }
    
    // For other doc types (objects/groups), don't modify them
    // as they're complex structures that shouldn't have wrapping removed
    return doc;
}
