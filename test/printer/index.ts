import test from 'ava';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { format } from 'prettier';
import * as SveltePlugin from '../../src';

let files = readdirSync('test/printer/samples').filter(
    (name) => name.endsWith('.html') || name.endsWith('.md'),
);
const formattingDirsHaveOnly = readdirSync('test/formatting/samples').some((d) =>
    d.endsWith('.only'),
);
const endsWithOnly = (f: string): boolean => f.endsWith('.only.html') || f.endsWith('.only.md');
const hasOnly = formattingDirsHaveOnly || files.some(endsWithOnly);
files = !hasOnly ? files : files.filter(endsWithOnly);

if (process.env.CI && hasOnly) {
    throw new Error('.only tests present');
}

for (const file of files) {
    const ending = file.split('.').pop();
    const input = readFileSync(`test/printer/samples/${file}`, 'utf-8').replace(/\r?\n/g, '\n');
    const options = readOptions(
        `test/printer/samples/${file.replace('.only', '').replace(`.${ending}`, '.options.json')}`,
    );

    test(`printer: ${file.slice(0, file.length - `.${ending}`.length)}`, async (t) => {
        const actualOutput = await format(input, {
            parser: ending === 'html' ? 'svelte' : 'markdown',
            plugins: [SveltePlugin],
            tabWidth: 4,
            ...options,
        });

        t.is(input, actualOutput, `Expected:\n${input}\n\nActual:\n${actualOutput}`);
    });
}

function readOptions(fileName: string) {
    if (!existsSync(fileName)) {
        return {};
    }

    const fileContents = readFileSync(fileName, 'utf-8');
    return JSON.parse(fileContents);
}
