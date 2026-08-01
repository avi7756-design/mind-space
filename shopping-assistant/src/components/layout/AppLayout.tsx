import { useCallback, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const openSidebar = useCallback(() => {
    // On a phone the soft keyboard would otherwise stay up and cover the menu
    // that just opened. Only blur real text fields — never steal focus from a
    // button the user is operating.
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      active.blur();
    }
    setSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    // Return focus to whatever opened the menu, so keyboard and VoiceOver users
    // are not dropped back at the top of the document.
    moreButtonRef.current?.focus();
  }, []);

  return (
    // The shell owns the height and the horizontal safe insets; the document
    // itself stays the single vertical scroller.
    <div className="app-shell safe-px flex">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="content-safe-pb flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSidebar={openSidebar} />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      <BottomNav onOpenMore={openSidebar} moreRef={moreButtonRef} />
    </div>
  );
}
