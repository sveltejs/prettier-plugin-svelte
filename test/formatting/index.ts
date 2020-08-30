import test from 'ava';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { format } from 'prettier';

const dirs = readdirSync('test/formatting/samples');

for (const dir of dirs) {
    const input = readFileSync(`test/formatting/samples/${dir}/input.html`, 'utf-8').replace(
        /\r?\n/g,
        '\n',
    );
    const expectedOutput = readFileSync(
        `test/formatting/samples/${dir}/output.html`,
        'utf-8',
    ).replace(/\r?\n/g, '\n');
    const options = readOptions(`test/formatting/samples/${dir}/options.json`);

    test(`formatting: ${dir}`, t => {
        const actualOutput = format(input, {
            parser: 'svelte' as any,
            plugins: [require.resolve('../../src')],
            tabWidth: 4,
            ...options,
        });
        t.is(expectedOutput, actualOutput);
    });
}

function readOptions(fileName: string) {
    if (!existsSync(fileName)) {
        return {};
    }

    const fileContents = readFileSync(fileName, 'utf-8');
    return JSON.parse(fileContents);
}
