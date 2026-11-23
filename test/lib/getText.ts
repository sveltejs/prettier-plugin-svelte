import test from 'ava';
import { parse } from 'svelte/compiler';
import { getText } from '../../src/lib/getText';

function getExpressionText(source: string) {
    const ast = parse(source, { modern: true });
    const expression: any = (ast.fragment.nodes[0] as any).expression;
    // Svelte does not put a comment before a `(` in `leadingComments` yet (sveltejs/svelte#19388)
    expression.leadingComments ??= ast.comments.filter(
        (comment) => comment.end <= expression.start,
    );
    return getText(expression, {
        originalText: source,
        locStart: (node: any) => node.start,
        locEnd: (node: any) => node.end,
    } as any);
}

const samples: Record<string, string> = {
    '{/* a */ value}': '/* a */ value',
    '{/* a */ (value)}': '/* a */ (value)',
    '{/* a */ ((value))}': '/* a */ ((value))',
    '{/* a */ ( /* b */ (value))}': '/* a */ ( /* b */ (value))',
    '{/* a */ (value /* b */)}': '/* a */ (value /* b */)',
    '{/* a */ (value // b\n)}': '/* a */ (value // b\n)',
    '{/* a */ (value) + 1}': '/* a */ (value) + 1',
    '{/* a */ (value + 1)}': '/* a */ (value + 1)',
};

for (const [source, expected] of Object.entries(samples)) {
    test(`getText: ${JSON.stringify(source)}`, (t) => {
        t.is(getExpressionText(source), expected);
    });
}
