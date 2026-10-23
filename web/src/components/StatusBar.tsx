import { itemCount } from "../lib/rows";
import { store } from "../store";

export default function StatusBar() {
  const items = () => store.visibleFolders().length + store.visibleFiles().length;
  return (
    <footer class="statusbar">
      {itemCount(items())} | {store.selected() ? 1 : 0} selected
    </footer>
  );
}
