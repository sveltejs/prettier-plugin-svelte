import { getSvelteVersion } from './getSvelteVersion';

export function importSvelte(importPath: string) {
    const version = getSvelteVersion(importPath);
    if (version.major <= 2) {
        return require(importPath);
    }

    const svelte = require(`${importPath}/compiler`);

    return {
        parse(text: string) {
            return svelte.compile(text, { generate: false }).ast;
        },
    };
}
