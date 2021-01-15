export const messageHandlers = {};

export let argCache = {};
export let currentLineNumber = 0;
export let currentOp = "";
export let currentShape;
export let externalShapes = {};
export let GUIState = {};
export let oc = null;
export let opNumber = 0; // This keeps track of the progress of the evaluation
export let usedHashes = {};

export const setArgCache = val => (argCache = val);
export const setCurrentOp = val => (currentOp = val);
export const setCurrentShape = val => (currentShape = val);
export const setCurrentLineNumber = val => (currentLineNumber = val);
export const resetExternalShapes = () => (externalShapes = {});
export const setGUIState = val => (GUIState = val);
export const setOc = ocInit => (oc = ocInit);
export const setOpNumber = val => (opNumber = val);
export const setUsedHashes = val => (usedHashes = val);


// I can't see anywhere, where the following globals are used, variables with these names exist, but they are scoped.
let fullShapeEdgeHashes = {};
let fullShapeFaceHashes = {};
