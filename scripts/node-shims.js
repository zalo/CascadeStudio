// Empty shims for Node.js builtins that openscad-parser references
// but doesn't use in browser context (fs, path, os are only used for
// file loading features like include/use which we don't support)
module.exports = {};
