"use client";

import { Bell, Lock, Settings, ShieldCheck, User } from "lucide-react";
import { useMemo, useState } from "react";

import { useAuthStore } from "@/store/auth.store";

const settingsSections = [
  { id: "profile", title: "Profile", icon: User },
  { id: "payment", title: "Payment", icon: Settings },
  { id: "security", title: "Security", icon: Lock },
  { id: "notifications", title: "Notifications", icon: Bell },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const user = useAuthStore((state) => state.user);

  const profileValues = useMemo(
    () => ({
      name: user?.name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "viewer",
      merchantId: user?.merchantId ?? "",
    }),
    [user]
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-blue-600">SmartPOS</p>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage the supported account and payment preferences for this merchant workspace.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <nav className="space-y-1">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={18} />
                  <span>{section.title}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {activeSection === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The authenticated merchant profile currently available to this session.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Full name</span>
                  <input value={profileValues.name} readOnly className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                  <input value={profileValues.email} readOnly className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Role</span>
                  <input value={profileValues.role} readOnly className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Merchant ID</span>
                  <input value={profileValues.merchantId} readOnly className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900" />
                </label>
              </div>
            </div>
          )}

          {activeSection === "payment" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Payment preferences</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Supported payment defaults for this merchant session.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Payment preferences are not yet backed by a persisted merchant settings API in this repository. The supported values are shown here for the current session only.
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Default fiat currency</span>
                  <select defaultValue="USD" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900">
                    <option value="USD">USD</option>
                    <option value="NGN">NGN</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Default crypto asset</span>
                  <select defaultValue="USDT" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900">
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                    <option value="ETH">ETH</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {activeSection === "security" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Security</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Security state is controlled by the authenticated session and backend auth system.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium text-slate-900">Session is authenticated and active.</span>
                </div>
              </div>
            </div>
          )}

          {activeSection === "notifications" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Notifications</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Notification settings are not yet persisted to the backend in this repo.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-sm font-medium text-slate-900">Payment alerts</span>
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-600" />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-sm font-medium text-slate-900">Transaction alerts</span>
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-600" />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

                    Profile information
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Your account details are currently managed through the authentication system.
                  </p>

                </div>

              </div>

            </div>

          )}

          {/* Security */}

          {activeSection === "security" && (

            <div className="p-6">

              <div className="border-b border-slate-200 pb-5">

                <h2 className="text-xl font-semibold text-slate-900">
                  Security
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Manage authentication and account security.
                </p>

              </div>

              <div className="py-6 space-y-4">

                <div className="rounded-lg border border-slate-200 p-5">

                  <h3 className="font-medium text-slate-900">
                    Password
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Password management will be connected to the authentication API.
                  </p>

                </div>

                <div className="rounded-lg border border-slate-200 p-5">

                  <h3 className="font-medium text-slate-900">
                    Authentication
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Authentication and session controls will be managed through the platform authentication system.
                  </p>

                </div>

              </div>

            </div>

          )}

          {/* Notifications */}

          {activeSection === "notifications" && (

            <div className="p-6">

              <div className="border-b border-slate-200 pb-5">

                <h2 className="text-xl font-semibold text-slate-900">
                  Notifications
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Manage platform notification preferences.
                </p>

              </div>

              <div className="py-6 space-y-4">

                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-5">

                  <div>

                    <h3 className="font-medium text-slate-900">
                      Platform Alerts
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Receive important alerts about platform activity and operations.
                    </p>

                  </div>

                  <div className="h-5 w-9 rounded-full bg-blue-600 p-1">

                    <div className="h-3 w-3 rounded-full bg-white" />

                  </div>

                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-5">

                  <div>

                    <h3 className="font-medium text-slate-900">
                      Transaction Alerts
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Receive notifications about important payment activity.
                    </p>

                  </div>

                  <div className="h-5 w-9 rounded-full bg-slate-300 p-1">

                    <div className="h-3 w-3 rounded-full bg-white" />

                  </div>

                </div>

              </div>

            </div>

          )}

        </div>

      </div>

    </div>
  );
}
