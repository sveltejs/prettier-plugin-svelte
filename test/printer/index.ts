import test from 'ava';
import { readdirSync, readFileSync } from 'fs';
import { format } from 'prettier';

const files = readdirSync('test/printer/samples').filter(name => name.endsWith('.html'));

for (const file of files) {
    const input = readFileSync(`test/printer/samples/${file}`, 'utf-8').replace(/\r?\n/g, '\n');

    test(`printer: ${file.slice(0, file.length - '.html'.length)}`, t => {
        const actualOutput = format(input, {
            parser: 'svelte' as any,
            plugins: [require.resolve('../../src')],
            tabWidth: 4,
        } as any);

        t.is(input, actualOutput);
    });
}
