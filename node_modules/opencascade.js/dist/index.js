import ocFullJS from "./opencascade.full.js";
import ocFullWasm from "./opencascade.full.wasm";

const initOpenCascade = ({
    mainJS = ocFullJS,
    mainWasm = ocFullWasm,
    libs = [],
    module = {},
  } = {}) => {
  return new Promise((resolve, reject) => {
    new mainJS({
      locateFile(path) {
        if(path.endsWith('.wasm')) {
          return mainWasm;
        }
        return path;
      },
      ...module
    }).then(async oc => {
      for(let lib of libs) {
        await oc.loadDynamicLibrary(lib, {loadAsync: true, global: true, nodelete: true, allowUndefined: false});
      }
      resolve(oc);
    });
  });
};

export default initOpenCascade;
