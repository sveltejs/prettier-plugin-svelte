module.exports = function(w) {
    return {
        files: ['src/**/*.ts', 'test/**/*.html'],
        tests: ['test/**/*.ts'],
        env: {
            type: 'node',
            runner: 'node',
        },
        testFramework: 'ava',
    };
};
