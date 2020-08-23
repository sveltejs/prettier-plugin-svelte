import test from 'ava';
import prettier,{ doc as prettierDoc, format, formatWithCursor } from 'prettier';
import { cloneDoc } from './debugprint';

const exampleA = `<div>
foo,
bar,
baz
</div>`;

const exampleB = `<div>
<b>one</b><b>two</b>
</div>`;

const exampleC = `<div>
<b>Apples and oranges and other nice things that are a long sentence</b>, <b>Apples and oranges and other nice things that are a long sentence</b>
</div>`;

const bug = `<div>
    <a href="/some-long-href-lorem-ipsum/">Lorem ipsum lorem ipsum 1</a>,
    <a href="/some-long-href-lorem-ipsum/">Lorem ipsum lorem ipsum 2</a>,
    <a href="/some-long-href-lorem-ipsum/">Lorem ipsum lorem ipsum 3</a>
</div>
`;

const doubleWhite = `{#if foo}
    <p>foo</p>
{/if}
`;

const doNotAddSpace = `<p>
<b>Apples</b><i>Orange</i><b>Bananas</b><i>Pineapples</i><b>Grapefruit</b><i>Kiwi</i>
</p>`;

const maintainSpace = `<p><b>Word</b> <b>Word</b></p>`;

test(`deleteme`, (t) => {
    const input = doubleWhite;

    //`<div><p>Apples</p>-<p>Orange</p>, <p>Bananas</p>, <p>Pineapples</p>, <p>Grapefruit</p>, <p>Pineapples</p>, <p>Grapefruit</p></div>`;

    const opts = {
        parser: 'svelte' as any,
        plugins: [require.resolve('../src')],
    };

    const doc = prettier.__debug.printToDoc(input, {
        ...opts,
    });

    console.log('doc:\n' + JSON.stringify(doc));

    const formatted = prettierDoc.printer.printDocToString(cloneDoc(doc), {
        ...opts,
        tabWidth: 4,
        printWidth: 80,
    } as any);
    
    console.log(`formatted:\n${formatted.formatted}***`)

    t.is(input, formatted.formatted);
});
