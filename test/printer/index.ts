import test from 'ava';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { format } from 'prettier';

const files = readdirSync('test/printer/samples').filter(name => name.endsWith('.html'));

for (const file of files) {
    const input = readFileSync(`test/printer/samples/${file}`, 'utf-8').replace(/\r?\n/g, '\n');
    const options = readOptions(`test/printer/samples/${file.replace('.html', '.options.json')}`);

    test(`printer: ${file.slice(0, file.length - '.html'.length)}`, t => {
        const actualOutput = format(input, {
            parser: 'svelte' as any,
            plugins: [require.resolve('../../src')],
            tabWidth: 4,
            ...options,
        } as any);

        t.is(input, actualOutput);
    });
}

function readOptions(fileName: string) {
    if (!existsSync(fileName)) {
        return {};
    }

    const fileContents = readFileSync(fileName, 'utf-8');
    return JSON.parse(fileContents);
}
