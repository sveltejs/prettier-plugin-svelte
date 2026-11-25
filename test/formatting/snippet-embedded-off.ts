import test from 'ava';
import { format } from 'prettier';
import { compile } from 'svelte/compiler';
import * as SveltePlugin from '../../src';

const samples: Record<string, string> = {
    '{#snippet foo(a, b)}x{/snippet}': '{#snippet foo(a, b)}x{/snippet}',
    '{#snippet foo()}x{/snippet}': '{#snippet foo()}x{/snippet}',
    '{#snippet foo()}{ /snippet }': '{#snippet foo()}{/snippet}',
    '{#snippet foo( {a,b}, [ c ], d = (({value: 1})) )}x{/snippet}':
        '{#snippet foo( {a,b}, [ c ], d = (({value: 1})) )}x{/snippet}',
    '{#snippet foo(a /* () {} */,\n b = () => ({value: 1}))}x{/snippet}':
        '{#snippet foo(a /* () {} */,\n b = () => ({value: 1}))}x{/snippet}',
    '{#snippet foo(\n // () {}\n a,\n)}x{/snippet}':
        '{#snippet foo(\n // () {}\n a,\n)}x{/snippet}',
    '{#snippet foo(a = `<script>let x = 1;</script>`)}x{/snippet}':
        '{#snippet foo(a = `<script>let x = 1;</script>`)}x{/snippet}',
    '<div>{#snippet foo(a,b)}<p  class = "x" >{a}</p>{/snippet}</div>':
        '<div>{#snippet foo(a,b)}<p class="x">{a}</p>{/snippet}</div>',
};

for (const [tag, attributes, content] of [
    ['script', 'type="module"', 'let x = 1;'],
    ['style', 'media="screen"', 'p { color:red; }'],
]) {
    for (const literal of [
        `<${tag}\n ${attributes}>${content}</${tag}>`,
        `<${tag}\n>${content}</${tag}>`,
        `<${tag} \t>${content}</${tag}>`,
        `<${tag}>${content}</${tag} >`,
        `<${tag}>${content}</${tag}\n>`,
        `<${tag}\n ${attributes} \t>${content}</${tag}\n >`,
    ]) {
        const input = '{#snippet foo(a = `' + literal + '`)}{a}{/snippet}';
        samples[input] = input;
    }
}

for (const [input, expected] of Object.entries(samples)) {
    test(`snippet with embedded formatting off: ${JSON.stringify(input)}`, async (t) => {
        const options = {
            parser: 'svelte',
            plugins: [SveltePlugin],
            embeddedLanguageFormatting: 'off' as const,
        };
        t.notThrows(() => compile(input, { generate: false }));
        const output = await format(input, options);

        t.is(output, expected + '\n');
        t.notThrows(() => compile(output, { generate: false }));
        t.is(await format(output, options), output);
    });
}

test('snippet with embedded formatting auto still formats parameters', async (t) => {
    const options = { parser: 'svelte', plugins: [SveltePlugin] };
    const output = await format('{#snippet foo( a,b = 1 )}x{/snippet}', options);

    t.is(output, '{#snippet foo(a, b = 1)}x{/snippet}\n');
    t.notThrows(() => compile(output, { generate: false }));
    t.is(await format(output, options), output);
});
