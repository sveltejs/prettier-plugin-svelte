import test from 'ava';
import { format } from 'prettier';
import { parse } from 'svelte/compiler';
import * as SveltePlugin from '../../src';

const samples: Record<string, string> = {
    '{(/foo/).test(value)}': '{(/foo/).test(value)}',
    '{(/^[A-Za-z ]+$/).test(value) ? x : y}': '{(/^[A-Za-z ]+$/).test(value) ? x : y}',
    '{(/ab/ig).test(value)}': '{(/ab/gi).test(value)}',
    '{(/a/)}': '{(/a/)}',
    '{(/a/)/* b */.source}': '{(/a/) /* b */.source}',
    '{(/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/).source.split("").join("-")}':
        '{(/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/).source\n  .split("")\n  .join("-")}',
    '{(/a/).exec(value).map((match) => {\n    return match;\n})}':
        '{(/a/).exec(value).map((match) => {\n  return match;\n})}',
    '{/* a */ value}': '{/* a */ value}',
    '<div title={(/a/).source}></div>': '<div title={/a/.source}></div>',
    '{#if (/a/).test(value)}x{/if}': '{#if /a/.test(value)}x{/if}',
};

for (const [input, expected] of Object.entries(samples)) {
    test(`regular expression at the start of an expression: ${JSON.stringify(input)}`, async (t) => {
        const options = { parser: 'svelte', plugins: [SveltePlugin] };
        const output = await format(input, options);

        t.is(output, expected + '\n');
        t.notThrows(() => parse(output, { modern: true }));
        t.is(await format(output, options), output);
    });
}
