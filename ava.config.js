process.env.TS_NODE_TRANSPILE_ONLY = true;

export default {
    compileEnhancements: false,
    extensions: ['ts'],
    require: ['ts-node/register'],
};
