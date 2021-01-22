import "../../css/main.css";
import { initialize } from "./CascadeMain";
import runtime from "serviceworker-webpack-plugin/lib/runtime";
import registerEvents from "serviceworker-webpack-plugin/lib/browser/registerEvents";

if (
  "serviceWorker" in navigator &&
  (window.location.protocol === "https:" ||
    window.location.hostname === "localhost")
) {
  const registration = runtime.register();
  registerEvents(registration, {
    onInstalled: () => {
      console.log("Registered Cascade Studio for offline use!");
    },
    onUpdateFailed: () => {
      console.log("Could not register Cascade Studio for offline use!");
    }
  });
} else {
  console.log("Browser does not support offline access!");
}

new initialize();
