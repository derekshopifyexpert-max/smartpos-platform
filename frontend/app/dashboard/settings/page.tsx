"use client";

import { useState } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  Lock,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth.store";

type Section = "profile" | "business" | "notifications" | "security";

export default function SettingsPage() {
  const { user } = useAuthStore();

  const [activeSection, setActiveSection] =
    useState<Section>("profile");

  const [name, setName] = useState(
    user?.name || user?.email?.split("@")[0] || ""
  );

  const [email, setEmail] = useState(user?.email || "");

  const [businessName, setBusinessName] = useState("");

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  const sections = [
    {
      id: "profile" as const,
      label: "Profile",
      description: "Your account information",
      icon: User,
    },
    {
      id: "business" as const,
      label: "Business",
      description: "Business information",
      icon: Building2,
    },
    {
      id: "notifications" as const,
      label: "Notifications",
      description: "Payment and transaction alerts",
      icon: Bell,
    },
    {
      id: "security" as const,
      label: "Security",
      description: "Authentication and account security",
      icon: Lock,
    },
  ];

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <SettingsIcon className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Settings
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage your SmartPOS account and business preferences.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <Card className="h-fit border-slate-200 bg-white shadow-sm">
            <CardContent className="p-2">
              <nav className="space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const active = activeSection === section.id;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />

                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {section.label}
                        </span>

                        <span className="mt-0.5 block text-xs text-slate-400">
                          {section.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>

          <div>
            {activeSection === "profile" && (
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                    <User className="h-5 w-5 text-blue-600" />
                    Profile
                  </CardTitle>

                  <p className="text-sm text-slate-500">
                    Manage your account information.
                  </p>
                </CardHeader>

                <CardContent className="space-y-5 p-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="profile-name"
                      className="text-sm font-medium text-slate-700"
                    >
                      Name
                    </label>

                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      className="bg-white text-slate-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="profile-email"
                      className="text-sm font-medium text-slate-700"
                    >
                      Email
                    </label>

                    <Input
                      id="profile-email"
                      value={email}
                      readOnly
                      className="bg-slate-50 text-slate-700"
                    />
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                    <div>
                      <p className="text-sm font-medium text-emerald-900">
                        Session is authenticated and active.
                      </p>

                      <p className="mt-1 text-xs text-emerald-700">
                        Your account is currently signed in to SmartPOS.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      onClick={handleSave}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save changes
                    </Button>

                    {saved && (
                      <span className="flex items-center gap-1 text-sm text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Saved
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === "business" && (
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Business
                  </CardTitle>

                  <p className="text-sm text-slate-500">
                    Manage the business information displayed in SmartPOS.
                  </p>
                </CardHeader>

                <CardContent className="space-y-5 p-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="business-name"
                      className="text-sm font-medium text-slate-700"
                    >
                      Business name
                    </label>

                    <Input
                      id="business-name"
                      value={businessName}
                      onChange={(event) =>
                        setBusinessName(event.target.value)
                      }
                      placeholder="Your business name"
                      className="bg-white text-slate-900"
                    />
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-800">
                      Business settings
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Additional business fields can be connected to the
                      merchant profile once the corresponding backend fields
                      are available.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleSave}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save changes
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeSection === "notifications" && (
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                    <Bell className="h-5 w-5 text-blue-600" />
                    Notifications
                  </CardTitle>

                  <p className="text-sm text-slate-500">
                    Control the notification preferences available in this
                    SmartPOS installation.
                  </p>
                </CardHeader>

                <CardContent className="space-y-4 p-6">
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Payment alerts
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Receive notifications when payments change status.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 accent-blue-600"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Transaction alerts
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Receive notifications about transaction activity.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 accent-blue-600"
                    />
                  </label>

                  <Button
                    type="button"
                    onClick={handleSave}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save preferences
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeSection === "security" && (
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                    <Lock className="h-5 w-5 text-blue-600" />
                    Security
                  </CardTitle>

                  <p className="text-sm text-slate-500">
                    Manage authentication and account security.
                  </p>
                </CardHeader>

                <CardContent className="space-y-5 p-6">
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                    <div>
                      <p className="text-sm font-medium text-emerald-900">
                        Account session active
                      </p>

                      <p className="mt-1 text-xs text-emerald-700">
                        SmartPOS has an authenticated session for this
                        account.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-900">
                      Authentication
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Password and authentication changes should continue to
                      use the existing authentication system rather than
                      storing credentials in the browser.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}