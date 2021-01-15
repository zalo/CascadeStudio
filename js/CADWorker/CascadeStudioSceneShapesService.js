export let sceneShapes = [];
export const resetSceneShapes = () => (sceneShapes = []);

/** This function returns a version of the `inputArray` without the `objectToRemove`. */
export function RemoveFromSceneShapes(objectToRemove) {
  sceneShapes = sceneShapes.filter(
    el => el.hash !== objectToRemove.hash || el.ptr !== objectToRemove.ptr
  );
  return sceneShapes;
}
