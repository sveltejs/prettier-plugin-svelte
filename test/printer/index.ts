import test from 'ava';
import { readdirSync, readFileSync } from 'fs';
import { format } from 'prettier';

const dirs = readdirSync('test/printer/samples');

for (const dir of dirs) {
    const input = readFileSync(`test/printer/samples/${dir}/input.html`, 'utf-8').replace(
        /\r?\n/g,
        '\n',
    );
    const expectedOutput = readFileSync(`test/printer/samples/${dir}/output.html`, 'utf-8').replace(
        /\r?\n/g,
        '\n',
    );

    test(`printer: ${dir}`, t => {
        const actualOutput = format(input, {
            parser: 'svelte' as any,
            plugins: [require.resolve('../../src')],
        });
        t.is(actualOutput, expectedOutput);
    });
}
