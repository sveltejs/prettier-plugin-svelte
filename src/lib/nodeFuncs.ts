import { Node, BindingNodeV2 } from '../print/nodes';

export function isBindingNodeV2(node: Node): node is BindingNodeV2 {
    return node.type === 'Binding' && 'value' in node;
}
