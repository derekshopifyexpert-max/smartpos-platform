"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  ChevronDown,
  ChevronRight,
  LogOut,
  X,
} from "lucide-react";

import { navigation } from "@/config/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useSidebarStore } from "@/store/sidebar.store";

export function Sidebar() {

  const pathname =
    usePathname();

  const router =
    useRouter();

  const clearAuth =
    useAuthStore(
      (state) => state.logout
    );

  const logout = () => {
    clearAuth();
    router.replace("/login");
  };

  const collapsed =
    useSidebarStore(
      (state) => state.collapsed
    );

  const mobileOpen = useSidebarStore(
    (state) => state.mobileOpen
  );

  const setMobileOpen = useSidebarStore(
    (state) => state.setMobileOpen
  );

  const showLabels = !collapsed || mobileOpen;

  const [openGroup, setOpenGroup] =
    useState<string | null>("Operations");

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/30 md:hidden"
        />
      )}

    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 md:sticky md:z-auto md:h-screen md:w-auto md:shrink-0 md:translate-x-0 md:shadow-none ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${collapsed ? "md:w-20" : "md:w-64"}`}
    >

      {/* Logo */}

      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 sm:px-6">

        {!showLabels ? (

          <div className="mx-auto text-xl font-bold text-blue-600">
            SP
          </div>

        ) : (

          <div>

            <h1 className="text-xl font-bold text-slate-900">
              SmartPOS
            </h1>

            <p className="text-xs text-slate-500">
              Admin Platform
            </p>

          </div>

        )}

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
        >
          <X className="h-5 w-5" />
        </button>

      </div>

      {/* Navigation */}

      <nav className="flex-1 overflow-y-auto px-3 py-4">

        <div className="space-y-1">

          {navigation.map((item) => {

            const Icon =
              item.icon;

            if (!item.children) {

              const active =
                pathname === item.href;

              return (

                  <Link
                  key={item.title}
                  href={item.href}
                    onClick={() => setMobileOpen(false)}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3 transition ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >

                  <Icon size={19} />

                  {showLabels && (

                    <span className="truncate text-sm font-medium">

                      {item.title}

                    </span>

                  )}

                </Link>

              );

            }

            const opened =
              openGroup === item.title;

            return (

              <div key={item.title}>

                <button
                  onClick={() =>
                    setOpenGroup(
                      opened
                        ? null
                        : item.title
                    )
                  }
                  className="flex h-11 w-full items-center justify-between rounded-xl px-3 text-slate-700 transition hover:bg-slate-100"
                >

                  <div className="flex items-center gap-3">

                    <Icon size={19} />

                    {showLabels && (

                      <span className="truncate text-sm font-medium">

                        {item.title}

                      </span>

                    )}

                  </div>

                  {showLabels && (

                    opened
                      ? <ChevronDown size={16} />
                      : <ChevronRight size={16} />

                  )}

                </button>

                {showLabels &&
                  opened && (

                    <div className="ml-7 mt-1 border-l border-slate-200 pl-3">

                      {item.children.map((child) => {

                        const ChildIcon =
                          child.icon;

                        const active =
                          pathname === child.href;

                        return (

                          <Link
                            key={child.title}
                            href={child.href}
                            onClick={() => setMobileOpen(false)}
                            className={`mb-1 flex h-10 items-center gap-3 rounded-lg px-3 transition ${
                              active
                                ? "bg-blue-50 font-medium text-blue-600"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >

                            <ChildIcon size={16} />

                            <span className="truncate text-sm">

                              {child.title}

                            </span>

                          </Link>

                        );

                      })}

                    </div>

                  )}

              </div>

            );

          })}

        </div>

      </nav>

      {/* Footer */}

      <div className="border-t border-slate-200 p-3">

        <button
          onClick={logout}
          className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-red-600 transition hover:bg-red-50"
        >

          <LogOut size={19} />

          {showLabels && (

            <span className="font-medium">

              Logout

            </span>

          )}

        </button>

      </div>

    </aside>

    </>

  );

}