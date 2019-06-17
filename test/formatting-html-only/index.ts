import test from 'ava';
import { readdirSync, readFileSync } from 'fs';
import { format } from 'prettier';

const files = readdirSync('test/formatting-html-only/samples').filter(name =>
    name.endsWith('.html'),
);

for (const file of files) {
    const input = readFileSync(`test/formatting-html-only/samples/${file}`, 'utf-8').replace(
        /\r?\n/g,
        '\n',
    );

    test(`formatting html: ${file.slice(0, file.length - '.html'.length)}`, t => {
        const expectedOutput = format(input, {
            parser: 'html' as any,
            tabWidth: 4,
        } as any);

        const actualOutput = format(input, {
            parser: 'svelte' as any,
            plugins: [require.resolve('../../src')],
            tabWidth: 4,
        } as any);

        t.is(expectedOutput, actualOutput);
    });
}
