import test from 'ava';
import { format } from 'prettier';
import { parse } from 'svelte/compiler';
import * as SveltePlugin from '../../src';

// Svelte 5.55.2 and later drop a comment that comes before a `(` of a template expression
// (sveltejs/svelte#19388). Svelte 5.55.1 and sveltejs/svelte#19389 put it in the
// `leadingComments` of the expression, so do the same here.
function attachComments(node: any, comments: any[]) {
    if (!node || typeof node !== 'object') return;
    for (const key of ['expression', 'test']) {
        const expression = node[key];
        if (expression?.start == null || expression.leadingComments) continue;
        const leadingComments = comments.filter(
            (comment) => comment.start >= node.start && comment.end <= expression.start,
        );
        if (leadingComments.length > 0) {
            expression.leadingComments = leadingComments;
        }
    }
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
            for (const child of value) attachComments(child, comments);
        } else if (value && typeof value === 'object') {
            attachComments(value, comments);
        }
    }
}

const sveltePlugin: any = SveltePlugin;
const plugin = {
    ...sveltePlugin,
    parsers: {
        ...sveltePlugin.parsers,
        svelte: {
            ...sveltePlugin.parsers.svelte,
            parse: async (text: string, options: any) => {
                const root = await sveltePlugin.parsers.svelte.parse(text, options);
                attachComments(root.fragment, root._comments);
                return root;
            },
        },
    },
};

const samples: Record<string, string> = {
    '{/* a */ (value)}': '{/* a */ value}',
    '{/* a */ ((value))}': '{/* a */ value}',
    '{/* a */ (value + 1)}': '{/* a */ value + 1}',
    '{/* a */ (value // b\n)}': '{/* a */ value}',
    '{/* a */ (value /* b */)}': '{/* a */ value}',
    '{/** @type {any} */ (value)}': '{/** @type {any} */ (value)}',
    '<div title={/* a */ (value)}></div>': '<div title={/* a */ value}></div>',
    '{#if /* a */ (value)}x{/if}': '{#if /* a */ value}x{/if}',
};

for (const [input, expected] of Object.entries(samples)) {
    test(`leading comment before parentheses: ${JSON.stringify(input)}`, async (t) => {
        const options = { parser: 'svelte', plugins: [plugin] };
        const output = await format(input, options);

        t.is(output, expected + '\n');
        t.notThrows(() => parse(output, { modern: true }));
        t.is(await format(output, options), output);
    });
}
