import test from 'ava';
import { format } from 'prettier';
import { parse } from 'svelte/compiler';
import * as SveltePlugin from '../../src';

const samples = {
    inline: '<span // comment\n>text</span>',
    'empty inline': '<span // comment\n></span>',
    'leading whitespace': '<span // comment\n> text</span>',
    'trailing whitespace': '<span // comment\n>text </span>',
    'surrounding whitespace': '<span // comment\n> text </span>',
    'long inline': '<span // comment\n>' + 'long text '.repeat(30).trimEnd() + '</span>',
    'long inline with trailing whitespace':
        '<span // comment\n>' + 'long text '.repeat(30) + '</span>',
    'inline with child': '<span // comment\n><em>text</em></span>',
    block: '<div // comment\n>text</div>',
    'empty block': '<div // comment\n></div>',
    pre: '<pre // comment\n>text</pre>',
    'empty pre': '<pre // comment\n></pre>',
    textarea: '<textarea // comment\n>text</textarea>',
    'empty textarea': '<textarea // comment\n></textarea>',
    component: '<Component // comment\n>text</Component>',
    'self-closing component': '<Component // comment\n/>',
    'dynamic element': '<svelte:element this={tag} // comment\n>text</svelte:element>',
    'dynamic component': '<svelte:component this={Component} // comment\n>text</svelte:component>',
    head: '<svelte:head // comment\n><title>text</title></svelte:head>',
    nested: '<div>before<span // comment\n>text</span>after</div>',
    'self-closing element': '<br // comment\n/>',
    doctype: '<!DOCTYPE // comment\n>',
    'multiple comments': '<span /* block */ // comment\n>text</span>',
};

for (const [name, input] of Object.entries(samples)) {
    for (const bracketSameLine of [false, true]) {
        for (const htmlWhitespaceSensitivity of ['css', 'strict', 'ignore'] as const) {
            test(`tag comments: ${name}, bracketSameLine=${bracketSameLine}, whitespace=${htmlWhitespaceSensitivity}`, async (t) => {
                const options = {
                    parser: 'svelte',
                    plugins: [SveltePlugin],
                    tabWidth: 4,
                    bracketSameLine,
                    htmlWhitespaceSensitivity,
                };
                const output = await format(input, options);

                // The closing bracket must follow the comment on its own line,
                // without an extra blank line from the element's normal separator.
                t.regex(output, /\/\/ comment\n[\t ]*\/?>/);
                t.notThrows(() => parse(output, { modern: true }));
                t.is(await format(output, options), output);
            });
        }
    }
}
