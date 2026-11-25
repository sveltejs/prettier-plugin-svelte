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

// Prettier 3.0 ignores `experimentalTernaries`, so these print the same without it
const experimentalTernariesSamples: Record<string, string> = {
    '<div>{(/^[A-Za-z ]+$/).test(value) ? x : y}</div>':
        '<div>{(/^[A-Za-z ]+$/).test(value) ? x : y}</div>',
    '{(/a/).source.length > 0 ? "yes" : "no"}': '{(/a/).source.length > 0 ? "yes" : "no"}',
};

function testSample(input: string, expected: string, extraOptions: Record<string, unknown> = {}) {
    test(`regular expression at the start of an expression: ${JSON.stringify(input)} ${JSON.stringify(extraOptions)}`, async (t) => {
        const options = { parser: 'svelte', plugins: [SveltePlugin], ...extraOptions };
        const output = await format(input, options);

        t.is(output, expected + '\n');
        t.notThrows(() => parse(output, { modern: true }));
        t.is(await format(output, options), output);
    });
}

for (const [input, expected] of Object.entries(samples)) {
    testSample(input, expected);
}
for (const [input, expected] of Object.entries(experimentalTernariesSamples)) {
    testSample(input, expected, { experimentalTernaries: true });
}
