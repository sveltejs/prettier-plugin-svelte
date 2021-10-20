import prettier from 'prettier/esm/standalone';
export const doc = prettier.doc;
// this file is used in rollup.standalone.esm.config.js
// It replaces the prettier import
// It is needed because the standalone versions do have default exports while
// the non-standalone versions do not.
