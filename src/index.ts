import { parse } from 'svelte';
import { print } from './print';
import { embed } from './embed';

function locStart(node: any) {
    return node.start;
}

function locEnd(node: any) {
    return node.end;
}

export const languages = [
    {
        name: 'svelte',
        parsers: 'svelte',
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
