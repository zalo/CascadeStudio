export const messageHandlers = {};

export let monacoEditor = null;
export let threejsViewport = {};
export let workerWorking = false;

export const setMonacoEditor = newEditor => (monacoEditor = newEditor);
export const setThreejsViewport = val => (threejsViewport = val);
export const setWorkerWorking = val => (workerWorking = val);
