import { Node, ScriptNode, InstanceScriptNode, ModuleScriptNode } from './nodes';
import { TagName } from '../lib/elements';
import { ParserOptions, FastPath } from 'prettier';

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
}

export function isASTNode(n: any): n is ASTNode {
    return 'html' in n && 'tokens' in n;
}

interface TagOptions {
    inline: Set<TagName>;
    preformatted: Set<TagName>;
}

const tagOptionsCache = new WeakMap<ParserOptions, TagOptions>();

function getTagOptions(options: ParserOptions) {
    let cached = tagOptionsCache.get(options);
    if (!cached) {
        cached = {
            inline: new Set(options.inlineElements),
            preformatted: new Set(options.preformattedElements)
        };
        tagOptionsCache.set(options, cached);
    }
    return cached;
}

export function isPreTagContent(path: FastPath, options: ParserOptions): boolean {
    const preTags = getTagOptions(options).preformatted;
    const stack = path.stack as Node[];
    return stack.some(node => node.type === 'Element' && preTags.has(node.name as TagName));
}
