"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  ArrowUpRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";

import {
  loginSchema,
  type LoginFormData,
} from "../schemas/login.schema";
import { useLogin } from "../hooks/use-login";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(data: LoginFormData) {
    loginMutation.mutate({
      email: data.email.trim(),
      password: data.password,
    });
  }

  return (
    <Card className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border-0 bg-[#f8f8f5] p-0 shadow-[0_30px_90px_rgba(0,0,0,0.35)] ring-1 ring-white/10 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="relative hidden min-h-[600px] overflow-hidden bg-[#1b2b2f] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(214,168,93,0.2),transparent_30%),radial-gradient(circle_at_85%_80%,rgba(42,161,152,0.18),transparent_35%)]" />
        <div className="relative">
          <div className="mb-16 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d6a85d] text-[#1b2b2f] shadow-lg shadow-[#d6a85d]/20">
              <span className="text-sm font-black tracking-tight">SP</span>
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">SmartPOS</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/50">Merchant control</p>
            </div>
          </div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#d6a85d]">One command surface</p>
          <h2 className="max-w-sm text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white">
            Move money with clarity.
          </h2>
          <p className="mt-6 max-w-xs text-sm leading-6 text-white/60">
            Your payments, terminals, and settlement activity in one composed workspace.
          </p>
        </div>
        <div className="relative flex items-center gap-3 border-t border-white/10 pt-5 text-xs text-white/50">
          <Activity className="h-4 w-4 text-[#58c4b4]" />
          <span>Platform services operational</span>
          <ArrowUpRight className="ml-auto h-4 w-4 text-white/30" />
        </div>
      </div>

      <div className="px-6 py-8 sm:px-12 sm:py-12">
        <div className="mb-9 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1b2b2f] text-[#d6a85d]">
              <span className="text-xs font-black">SP</span>
            </div>
            <div>
              <p className="font-semibold tracking-tight text-[#1b2b2f]">SmartPOS</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">Merchant control</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#258f84]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2aa198]" /> Live
          </span>
        </div>

        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#258f84]">
            <ShieldCheck className="h-4 w-4" /> Secure workspace
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#1b2b2f] sm:text-4xl">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to continue to your merchant workspace.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
        >
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Email Address
            </Label>

            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
                disabled={loginMutation.isPending}
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-sm focus:border-[#2aa198] focus:ring-[#2aa198]/20"
                {...register("email")}
              />
            </div>

            {errors.email ? (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span className="w-1 h-1 bg-red-500 rounded-full" />
                {errors.email.message}
              </p>
            ) : null}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Password
            </Label>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loginMutation.isPending}
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-10 text-sm shadow-sm focus:border-[#2aa198] focus:ring-[#2aa198]/20"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loginMutation.isPending}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-[#258f84] disabled:opacity-50"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {errors.password ? (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span className="w-1 h-1 bg-red-500 rounded-full" />
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {/* Error Message */}
          {loginMutation.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">
                <span className="font-medium">Sign in failed.</span> Please check your credentials and try again.
              </p>
            </div>
          ) : null}

          {/* Sign In Button */}
          <Button
            className="mt-8 h-12 w-full rounded-xl bg-[#1b2b2f] font-semibold text-white shadow-lg shadow-[#1b2b2f]/20 transition-all hover:-translate-y-0.5 hover:bg-[#263d42]"
            disabled={loginMutation.isPending}
            type="submit"
          >
            {loginMutation.isPending ? (
              <>
                <Spinner className="w-4 h-4" />
                <span className="ml-2">Signing in...</span>
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

      </div>
    </Card>
  );
}