import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript';

export default {
    input: 'src/index.ts',
    plugins: [resolve(), commonjs(), typescript()],
    external: ['prettier', 'svelte', 'svelte/compiler'],
    output: {
        file: 'plugin.js',
        format: 'cjs',
        sourcemap: true,
    },
};
