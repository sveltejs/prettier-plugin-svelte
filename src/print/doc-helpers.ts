import { Doc, doc } from 'prettier';

export function isLine(doc: Doc) {    
  return typeof doc === 'object' && doc.type === 'line' 
} 

export function isLineDiscardedIfLonely(doc: Doc) {
  return isLine(doc) && !(doc as doc.builders.Line).keepIfLonely
}
