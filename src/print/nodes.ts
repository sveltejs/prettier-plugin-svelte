export * from '../../node_modules/svelte/src/compiler/types/template.js';
import { Comment } from '../../node_modules/svelte/src/compiler/types/template.js';

//export interface SvelteNodeExtension {
//    /** Whether this node is JS (not HTML/Svelte stuff) */
//    isJS?: boolean;
//    /** Whether or not to print this node as a function */
//    asFunction?: boolean;
//    /** Whether or not to force single quotes when printing as JS */
//    forceSingleQuote?: boolean;
//    /** Whether or not to force a single line when printing as JS */
//    forceSingleLine?: boolean;
//    /** Whether or not to remove outer `()` when printing as JS */
//    removeParentheses?: boolean;
//}

//export interface HasComments {
//    comments: CommentInfo[];
//}
//export interface StyleNode extends BaseNode {
//export interface ScriptNode extends BaseNode {
//export interface StyleProgramNode extends BaseNode {

export interface CommentInfo {
    comment: Comment;
    emptyLineAfter: boolean;
}

//export interface Script extends BaseNode {
//        type: 'Script';
//        context: string;
//        content: Program;
//    }
