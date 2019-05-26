import { SupportLanguage, Parser, Printer } from 'prettier';
import { print } from './print';
import { embed } from './embed';
import { snipTagContent } from './lib/snipTagContent';

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
        extensions: ['.svelte'],
    },
];

export const parsers: Record<string, Parser> = {
    svelte: {
        parse: text => {
            try {
                return require(`svelte/compiler`).parse(text);
            } catch (err) {
                err.loc = {
                    start: err.start,
                    end: err.end,
                };
                delete err.start;
                delete err.end;
                throw err;
            }
        },
        preprocess: text => {
            text = snipTagContent('style', text);
            text = snipTagContent('script', text, '{}');
            return text.trim();
        },
        locStart,
        locEnd,
        astFormat: 'svelte-ast',
    },
};

export const printers: Record<string, Printer> = {
    'svelte-ast': {
        print,
        embed,
    },
};

export { options } from './options';
