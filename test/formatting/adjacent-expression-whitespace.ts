import test from 'ava';
import { readFileSync } from 'fs';
import { format } from 'prettier';
import { compile } from 'svelte/compiler';
import * as SveltePlugin from '../../src';

const input = readFileSync(
    'test/formatting/samples/adjacent-expression-whitespace/input.html',
    'utf-8',
);

for (const printWidth of [40, 80]) {
    test(`adjacent expressions preserve the rendered separator at width ${printWidth}`, async (t) => {
        const options = { parser: 'svelte', plugins: [SveltePlugin], useTabs: true, printWidth };
        const output = await format(input, options);

        t.true(output.includes('{item.first_part} {item.second_part}'));
        for (const generate of ['client', 'server'] as const) {
            t.is(compile(output, { generate }).js.code, compile(input, { generate }).js.code);
        }
        t.is(await format(output, options), output);
    });
}

test('adjacent expressions keep existing line breaks', async (t) => {
    const input = '<span>\n\t{first}\n\t{second}\n</span>\n';
    const options = { parser: 'svelte', plugins: [SveltePlugin], useTabs: true };

    t.is(await format(input, options), input);
});
