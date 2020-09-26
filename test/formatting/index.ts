import test from 'ava';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { format } from 'prettier';

let dirs = readdirSync('test/formatting/samples');
const endsWithOnly = (f: string): boolean => f.endsWith('.only');
const hasOnly = dirs.some(endsWithOnly);
dirs = !hasOnly ? dirs : dirs.filter(endsWithOnly);

if (process.env.CI && hasOnly) {
    throw new Error('.only tests present');
}

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

    test(`formatting: ${dir}`, (t) => {
        let onTestCompleted;

        if ((options as any).expectSyntaxErrors) {
            onTestCompleted = doNotLogSyntaxErrors();
        }

        try {
            const actualOutput = format(input, {
                parser: 'svelte' as any,
                plugins: [require.resolve('../../src')],
                tabWidth: 4,
                ...options,
            });

            t.is(expectedOutput, actualOutput);
        } finally {
            if (onTestCompleted) {
                onTestCompleted();
            }
        }
    });
}

/**
 * Overwrite `console.error` so as to not report any syntax errors
 * (there are tests that intentionally produce them).
 * Returns a function that restores the original `console.error`.
 */
function doNotLogSyntaxErrors(): () => {} {
    const delegate = console.error;

    console.error = (...args: any[]) => {
        const e = args[0];

        if (e instanceof SyntaxError) {
            // swallow
        } else {
            delegate(...args);
        }
    };

    return () => (console.error = delegate);
}

function readOptions(fileName: string) {
    if (!existsSync(fileName)) {
        return {};
    }

    const fileContents = readFileSync(fileName, 'utf-8');
    return JSON.parse(fileContents);
}
