import { Doc, doc } from 'prettier';

export function isLine(doc: Doc) {    
  return typeof doc === 'object' && doc.type === 'line' 
} 

export function isLineDiscardedIfLonely(doc: Doc) {
  return isLine(doc) && !(doc as doc.builders.Line).keepIfLonely
}

export function isEmptyDoc(doc: Doc): boolean {
  if (typeof doc === 'string') {
      return doc.length == 0;
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
  return !group.find(doc => !isEmptyDoc(doc))
}
