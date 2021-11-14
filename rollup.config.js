import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript';
import alias from '@rollup/plugin-alias';
import path from 'path';

const srcDir = path.resolve(__dirname, 'src');

export default [
    // Default - CommonJS
    {
        input: 'src/index.ts',
        plugins: [resolve(), commonjs(), typescript()],
        external: ['prettier', 'svelte', 'svelte/compiler'],
        output: {
            file: 'plugin.js',
            format: 'cjs',
            sourcemap: true,
        },
    },
    // Standalone - CommonJS
    {
        input: 'src/index.ts',
        plugins: [
            alias({
                entries: [{ find: /^prettier$/gm, replacement: `prettier/standalone` }],
            }),
            resolve({
                preferBuiltins: false,
                browser: true,
            }),
            commonjs(),
            typescript({}),
        ],
        external: ['prettier/standalone', 'svelte/compiler'],
        output: {
            file: 'standalone.js',
            format: 'cjs',
            sourcemap: false,
        },
    },
    // Standalone - ESM
    {
        input: 'src/index.ts',
        plugins: [
            alias({
                entries: [{ find: /^prettier$/gm, replacement: `${srcDir}/standalone-shim` }],
            }),
            resolve({
                preferBuiltins: false,
                browser: true,
            }),
            commonjs(),
            typescript({}),
        ],
        external: ['prettier/esm/standalone', 'svelte/compiler'],
        output: {
            file: 'esm/standalone.mjs',
            format: 'esm',
            sourcemap: false,
        },
    },
];
