import opencascade from "./dist/opencascade.wasm.js";
import wasmFile from "./dist/opencascade.wasm.wasm";

export const initOpenCascade = () => {
  return new opencascade({
    locateFile(path) {
      if(path.endsWith('.wasm')) {
        return wasmFile;
      }
      return path;
    }
  });
}
