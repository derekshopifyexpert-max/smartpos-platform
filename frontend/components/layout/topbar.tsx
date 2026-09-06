"use client";

import {
  Menu,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useSidebarStore } from "@/store/sidebar.store";

export function Topbar() {
  const toggle =
    useSidebarStore(
      (state) => state.toggle
    );

  const toggleMobile = useSidebarStore(
    (state) => state.toggleMobile
  );

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const handleToggle = () => {
    if (isMobile) {
      toggleMobile();
    } else {
      toggle();
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">

      <div className="flex h-16 items-center justify-between px-4 sm:px-6">

        {/* Left */}

        <div className="flex items-center gap-4">

          <button
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <Menu size={20} />
          </button>

          <div>

            <h2 className="text-xl font-semibold text-slate-900">
              Dashboard
            </h2>

            <p className="text-sm text-slate-500">
              SmartPOS Platform
            </p>

          </div>

        </div>

      </div>

    </header>
  );
}