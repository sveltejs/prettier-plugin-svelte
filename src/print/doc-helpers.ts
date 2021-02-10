import { Doc, doc } from 'prettier';
import { findLastIndex } from './helpers';

export function isLine(docToCheck: Doc): boolean {
    return (
        docToCheck === doc.builders.hardline ||
        (typeof docToCheck === 'object' && docToCheck.type === 'line') ||
        (typeof docToCheck === 'object' &&
            docToCheck.type === 'concat' &&
            docToCheck.parts.every(isLine))
    );
}

/**
 * Check if the doc is empty, i.e. consists of nothing more than empty strings (possibly nested).
 */
export function isEmptyDoc(doc: Doc): boolean {
    if (typeof doc === 'string') {
        return doc.length === 0;
    }

    if (doc.type === 'line') {
        return !doc.keepIfLonely;
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
 * Trims the leading nodes matching `isWhitespace` independent of nesting level (though all nodes need to be a the same level)
 * and returnes the removed nodes.
 */
export function trimLeft(group: Doc[], isWhitespace: (doc: Doc) => boolean): Doc[] | undefined {
    let firstNonWhitespace = group.findIndex((doc) => !isWhitespace(doc));

    if (firstNonWhitespace < 0 && group.length) {
        firstNonWhitespace = group.length;
    }

    if (firstNonWhitespace > 0) {
        return group.splice(0, firstNonWhitespace);
    } else {
        const parts = getParts(group[0]);

        if (parts) {
            return trimLeft(parts, isWhitespace);
        }
    }
}

/**
 * Trims the trailing nodes matching `isWhitespace` independent of nesting level (though all nodes need to be a the same level)
 * and returnes the removed nodes.
 */
export function trimRight(group: Doc[], isWhitespace: (doc: Doc) => boolean): Doc[] | undefined {
    let lastNonWhitespace = group.length ? findLastIndex((doc) => !isWhitespace(doc), group) : 0;

    if (lastNonWhitespace < group.length - 1) {
        return group.splice(lastNonWhitespace + 1);
    } else {
        const parts = getParts(group[group.length - 1]);

        if (parts) {
            return trimRight(parts, isWhitespace);
        }
    }
}

function getParts(doc: Doc): Doc[] | undefined {
    if (typeof doc === 'object') {
        if (doc.type === 'fill' || doc.type === 'concat') {
            return doc.parts;
        }
        if (doc.type === 'group') {
            return getParts(doc.contents);
        }
    }
}
