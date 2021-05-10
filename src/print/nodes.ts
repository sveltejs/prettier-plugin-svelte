export interface BaseNode {
    start: number;
    end: number;
    isJS?: boolean;
    forceSingleQuote?: boolean;
    forceSingleLine?: boolean;
}

export interface FragmentNode extends BaseNode {
    type: 'Fragment';
    children: Node[];
}

export interface ElementNode extends BaseNode {
    type: 'Element';
    name: string;
    attributes: Node[];
    children: Node[];
}

export interface TextNode extends BaseNode {
    type: 'Text';
    data: string;
    raw: string;
}

export interface MustacheTagNode extends BaseNode {
    type: 'MustacheTag';
    expression: Node;
}

export interface AttributeNode extends BaseNode {
    type: 'Attribute';
    name: string;
    value: Node[] | true;
}

export interface IdentifierNode extends BaseNode {
    type: 'Identifier';
    name: string;
}

export interface AttributeShorthandNode extends BaseNode {
    type: 'AttributeShorthand';
    name: string;
    expression: Node;
}

export interface IfBlockNode extends BaseNode {
    type: 'IfBlock';
    expression: Node;
    children: Node[];
    else?: Node;
}

export interface ElseBlockNode extends BaseNode {
    type: 'ElseBlock';
    children: Node[];
}

export interface EachBlockNode extends BaseNode {
    type: 'EachBlock';
    expression: Node;
    children: Node[];
    context: Node;
    index?: string;
    else?: Node;
    key?: Node;
}

export interface AwaitBlockNode extends BaseNode {
    type: 'AwaitBlock';
    expression: Node;
    value?: Node;
    error?: Node;
    pending: PendingBlockNode;
    then: ThenBlockNode;
    catch: CatchBlockNode;
}

export interface KeyBlockNode extends BaseNode {
    type: 'KeyBlock';
    expression: Node;
    children: Node[];
}

export interface ThenBlockNode extends BaseNode {
    type: 'ThenBlock';
    children: Node[];
}

export interface PendingBlockNode extends BaseNode {
    type: 'PendingBlock';
    children: Node[];
}

export interface CatchBlockNode extends BaseNode {
    type: 'CatchBlock';
    children: Node[];
}

export interface EventHandlerNode extends BaseNode {
    type: 'EventHandler';
    name: string;
    expression?: Node;
    modifiers?: string[];
}

export interface BindingNode extends BaseNode {
    type: 'Binding';
    name: string;
    expression: Node;
}

export interface ClassNode extends BaseNode {
    type: 'Class';
    name: string;
    expression: Node;
}

export interface LetNode extends BaseNode {
    type: 'Let';
    name: string;
    expression: Node;
}

export interface DebugTagNode extends BaseNode {
    type: 'DebugTag';
    identifiers: Node[];
}

export interface RefNode extends BaseNode {
    type: 'Ref';
    name: string;
}

export interface InlineComponentNode extends BaseNode {
    type: 'InlineComponent';
    name: string;
    attributes: Node[];
    children: Node[];
    expression: Node;
}

export interface CommentNode extends BaseNode {
    type: 'Comment';
    data: string;
}

export interface SlotNode extends BaseNode {
    type: 'Slot';
    name: string;
    attributes: Node[];
    children: Node[];
}

export interface WindowNode extends BaseNode {
    type: 'Window';
    name: string;
    attributes: Node[];
    children: Node[];
}

export interface HeadNode extends BaseNode {
    type: 'Head';
    name: string;
    attributes: Node[];
    children: Node[];
}

export interface TitleNode extends BaseNode {
    type: 'Title';
    name: string;
    attributes: Node[];
    children: Node[];
}

export interface TransitionNode extends BaseNode {
    type: 'Transition';
    name: string;
    expression?: Node;
    modifiers?: string[];
    intro: boolean;
    outro: boolean;
}

export interface ActionNode extends BaseNode {
    type: 'Action';
    name: string;
    expression?: Node;
}

export interface StyleNode extends BaseNode {
    type: 'Style';
    attributes: Node[];
    children: Node[];
    content: StyleProgramNode;
}

export interface ScriptNode extends BaseNode {
    type: 'Script';
    attributes: Node[];
    content: Node;
}

export interface StyleProgramNode extends BaseNode {
    type: 'StyleProgram';
    styles: string;
}

export interface ProgramNode extends BaseNode {
    type: 'Program';
    body: Node[];
}

export interface AnimationNode extends BaseNode {
    type: 'Animation';
    name: string;
    expression?: Node;
}

export interface RawMustacheTagNode extends BaseNode {
    type: 'RawMustacheTag';
    expression: Node;
}

export interface SpreadNode extends BaseNode {
    type: 'Spread';
    expression: Node;
}

export interface InstanceScriptNode extends BaseNode {
    type: 'InstanceScript';
    context: string;
    content: Node;
}

export interface ModuleScriptNode extends BaseNode {
    type: 'ModuleScript';
    context: string;
    content: Node;
}

export interface BodyNode extends BaseNode {
    type: 'Body';
    name: string;
    attributes: Node[];
}

export interface OptionsNode extends BaseNode {
    type: 'Options';
    name: string;
    attributes: Node[];
}

export interface SlotTemplateNode extends BaseNode {
    type: 'SlotTemplate';
    name: string;
    attributes: Node[];
    children: Node[];
}

export type Node =
    | FragmentNode
    | ElementNode
    | TextNode
    | MustacheTagNode
    | AttributeNode
    | IdentifierNode
    | AttributeShorthandNode
    | IfBlockNode
    | ElseBlockNode
    | EachBlockNode
    | AwaitBlockNode
    | KeyBlockNode
    | ThenBlockNode
    | PendingBlockNode
    | CatchBlockNode
    | EventHandlerNode
    | BindingNode
    | ClassNode
    | LetNode
    | DebugTagNode
    | RefNode
    | InlineComponentNode
    | CommentNode
    | SlotNode
    | WindowNode
    | HeadNode
    | TitleNode
    | TransitionNode
    | ActionNode
    | StyleNode
    | ScriptNode
    | StyleProgramNode
    | ProgramNode
    | AnimationNode
    | RawMustacheTagNode
    | SpreadNode
    | InstanceScriptNode
    | ModuleScriptNode
    | BodyNode
    | OptionsNode
    | SlotTemplateNode;

/**
 * The Svelte AST root node
 */
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
    /**
     * This is not actually part of the Svelte parser output,
     * but we add it afterwards to make sure we can distinguish
     * the root node from other nodes afterwards.
     */
    __isRoot: boolean;
}
