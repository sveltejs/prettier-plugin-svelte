import alias from '@rollup/plugin-alias';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default [
    // CommonJS build
    {
        input: 'src/index.ts',
        plugins: [resolve(), typescript()],
        external: ['prettier', 'svelte/compiler'],
        output: {
            file: 'plugin.js',
            format: 'cjs',
            sourcemap: true,
        },
    },
    // Browser build
    // Supported use case: importing the plugin from a bundler like Vite or Webpack
    // Semi-supported use case: importing the plugin directly in the browser through using import maps.
    //                          (semi-supported because it requires a svelte/compiler.cjs import map and the .cjs ending has the wrong mime type on CDNs)
    {
        input: 'src/index.ts',
        plugins: [
            alias({
                entries: [{ find: 'prettier', replacement: 'prettier/standalone' }],
            }),
            resolve(),
            typescript(),
        ],
        external: ['prettier/standalone', 'prettier/plugins/babel', 'svelte/compiler'],
        output: {
            file: 'browser.js',
            format: 'esm',
        },
    },
];
