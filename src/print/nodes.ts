import type { Node as ESTreeNode, Comment } from 'estree';
import type { AST } from 'svelte/compiler';

export interface BaseNode {
    start: number;
    end: number;
    /** Whether this node is JS (not HTML/Svelte stuff) */
    isJS?: boolean;
    /** Whether or not to print this node as a function */
    asFunction?: boolean;
    /** Whether or not to force single quotes when printing as JS */
    forceSingleQuote?: boolean;
    /** Whether or not to force a single line when printing as JS */
    forceSingleLine?: boolean;
    /** Whether or not to remove outer `()` when printing as JS */
    removeParentheses?: boolean;
    /** Whether or not to surround the result with a group and softline so that an exceeding print with keeps the output on the same line, if possible */
    surroundWithSoftline?: boolean;
}

export type TextNode = AST.Text;
export type AttributeNode = AST.Attribute;
export type StyleDirectiveNode = AST.StyleDirective;
export type MustacheTagNode = AST.ExpressionTag;
export type AttributeShorthandNode = AST.ExpressionTag;
export type IfBlockNode = AST.IfBlock;
export type AwaitBlockNode = AST.AwaitBlock;
export type EachBlockNode = AST.EachBlock;
export type KeyBlockNode = AST.KeyBlock;
export type CommentNode = AST.Comment;
export type ScriptNode = AST.Script & { comments?: CommentInfo[] };
export type StyleNode = AST.CSS.StyleSheet & { comments?: CommentInfo[] };
export type SvelteBoundary = AST.SvelteBoundary;
export type ElementNode =
    | AST.RegularElement
    | AST.Component
    | AST.SvelteComponent
    | AST.SvelteSelf
    | AST.SvelteElement
    | AST.SlotElement
    | AST.SvelteWindow
    | AST.SvelteHead
    | AST.TitleElement
    | AST.SvelteFragment
    | AST.SvelteBody
    | AST.SvelteDocument
    | AST.SvelteBoundary;

export interface OptionsNode {
    type: 'Options';
    name: 'svelte:options';
    start: number;
    end: number;
    attributes: AST.Attribute[];
}

export interface CommentInfo {
    comment: CommentNode;
    emptyLineAfter: boolean;
}

export type Node =
    | (AST.TemplateNode & BaseNode)
    | (AST.Fragment & BaseNode)
    | (ScriptNode & BaseNode)
    | (StyleNode & BaseNode)
    | (AST.CSS.Node & BaseNode)
    | (ESTreeNode & BaseNode)
    | OptionsNode;

export type ASTNode = AST.Root & {
    _comments?: Comment[];
    __isRoot: boolean;
};
