import { messageHandlers } from "./CascadeState";
import Worker from "worker-loader!../CADWorker/CascadeStudioMainWorker.js";

// Begins loading the CAD Kernel Web Worker
let cascadeStudioWorker;
if (window.Worker) {
  cascadeStudioWorker = new Worker();
  // Ping Pong Messages Back and Forth based on their registration in messageHandlers
  cascadeStudioWorker.onmessage = function(e) {
    if (e.data.type in messageHandlers) {
      let response = messageHandlers[e.data.type](e.data.payload);
      if (response) {
        cascadeStudioWorker.postMessage({
          type: e.data.type,
          payload: response
        });
      }
    }
  }
}

export default cascadeStudioWorker;
