import { render } from "solid-js/web";
import { getRoot } from "./api";
import App from "./App";
import { store } from "./store";
// Brand fonts are bundled (no external font requests): Plus Jakarta Sans for text, IBM Plex Mono for readouts.
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles.css";

const mount = document.getElementById("root")!;

// Ask the server where browsing starts, then show the app.
getRoot()
  .then((root) => {
    store.init(root);
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
