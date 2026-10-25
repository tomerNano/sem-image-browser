import { PanelIcon } from "./Icons";
import { sidebarOpen, toggleSidebar } from "./Splitter";

/** Opens or closes the sidebar. Sits next to the logo, and under the emblem in the closed rail. */
export default function SidebarToggle() {
  const label = () => (sidebarOpen() ? "Close sidebar (Ctrl+B)" : "Open sidebar (Ctrl+B)");
  return (
    <button class="icon-btn sidebar-toggle" title={label()} aria-label={label()} onClick={toggleSidebar}>
      <PanelIcon size={18} />
    </button>
  );
}
