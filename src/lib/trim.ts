import { Doc } from 'prettier';

/**
 * Trims the leading nodes matching `isWhitespace` independent of nesting level (though all nodes need to be a the same level)
 * and returnes the trimmed nodes.
 */
export function trimLeft(group: Doc[], isWhitespace: (doc: Doc) => boolean): Doc[] | undefined {
    const firstNonWhitespace = group.findIndex((doc) => !isWhitespace(doc), group);

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
 * and returnes the trimmed nodes.
 */
export function trimRight(group: Doc[], isWhitespace: (doc: Doc) => boolean): Doc[] | undefined {
    const lastNonWhitespace = findLastIndex((doc) => !isWhitespace(doc), group);

    if (lastNonWhitespace < group.length) {
        return group.splice(lastNonWhitespace);
    } else {
        const parts = getParts(group[group.length - 1]);

        if (parts) {
            return trimRight(parts, isWhitespace);
        }
    }
}

function getParts(doc: Doc): Doc[] | undefined {
    if (typeof doc === 'object' && (doc.type === 'fill' || doc.type === 'concat')) {
        return doc.parts;
    }
}

function findLastIndex<T>(filter: (item: T) => boolean, items: T[]) {
    for (let i = items.length - 1; i >= 0; i--) {
        if (filter(items[i])) {
            return i + 1;
        }
    }

    return 0;
}
