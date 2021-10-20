import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript';
import alias from '@rollup/plugin-alias';

export default {
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
};
