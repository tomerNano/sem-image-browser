import { render } from "solid-js/web";
import { getRoot, reportClientError } from "./api";
import App from "./App";
import { startPrefix, syncHistory } from "./history";
import { store } from "./store";
// Brand fonts are bundled (no external font requests): Plus Jakarta Sans for text, IBM Plex Mono for readouts.
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles.css";

const mount = document.getElementById("root")!;

// Script errors the page did not catch also go to the server log, with the page they happened on.
window.addEventListener("error", (e) => {
  reportClientError(`Script error on ${location.pathname}: ${e.message} (${e.filename}:${e.lineno})`);
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : String(e.reason);
  reportClientError(`Unhandled promise rejection on ${location.pathname}: ${reason}`);
});

// Ask the server where browsing starts, open the folder in the page address, then show the app.
getRoot()
  .then((root) => {
    store.init(root, startPrefix(root.prefix));
    syncHistory();
    render(() => <App />, mount);
  })
  .catch((err: Error) => {
    mount.innerHTML = "";
    const p = document.createElement("p");
    p.className = "error";
    p.style.padding = "12px";
    p.textContent = `Cannot reach the server: ${err.message}`;
    mount.append(p);
  });
