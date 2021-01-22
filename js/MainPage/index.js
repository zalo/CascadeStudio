import "../../css/main.css";
import { initialize } from "./CascadeMain";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").then(
    (registration) => {
      registration.update(); // Always update the registration for the latest assets
    },
    () => {
      console.log("Could not register Cascade Studio for offline use!");
    }
  );
} else {
  console.log("Browser does not support offline access!");
}

new initialize();
