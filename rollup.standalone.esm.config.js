import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript';
import alias from '@rollup/plugin-alias';
import path from 'path';

const srcDir = path.resolve(__dirname, 'src');
export default {
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
};
