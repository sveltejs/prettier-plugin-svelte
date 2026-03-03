declare module '@typescript-eslint/types' {
    export namespace TSESTree {
        interface Node {
            type: string;
        }

        interface Expression extends Node {}
    }
}
