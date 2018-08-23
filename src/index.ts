import { parse } from 'svelte';
import { SupportLanguage } from 'prettier';
import { print } from './print';
import { embed } from './embed';

function locStart(node: any) {
    return node.start;
}

function locEnd(node: any) {
    return node.end;
}

export const languages: Partial<SupportLanguage>[] = [
    {
        name: 'svelte',
        parsers: ['svelte'],
        extensions: ['.svelte', '.html'],
    },
];

export const parsers = {
    svelte: {
        parse: (text: string) => parse(text),
        locStart,
        locEnd,
        astFormat: 'svelte-ast',
    },
};

export const printers = {
    'svelte-ast': {
        print,
        embed,
    },
};
