"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

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
    <Card className="w-full max-w-md overflow-hidden shadow-xl">
      {/* Header Gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-12 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span className="font-bold text-blue-600">SP</span>
          </div>
          <h1 className="text-3xl font-bold">SmartPOS</h1>
        </div>
        <p className="text-blue-100 text-sm">Crypto Payment Platform</p>
      </div>

      {/* Form Content */}
      <div className="px-8 py-8">
        <div className="mb-8">
          <p className="text-slate-600 text-center font-medium">
            Welcome back
          </p>
          <p className="text-slate-400 text-center text-sm mt-2">
            Sign in to your account to continue
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
        >
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700 font-medium">
              Email Address
            </Label>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
                disabled={loginMutation.isPending}
                className="pl-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
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
            <Label htmlFor="password" className="text-slate-700 font-medium">
              Password
            </Label>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loginMutation.isPending}
                className="pl-10 pr-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loginMutation.isPending}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors"
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">
                <span className="font-medium">Sign in failed.</span> Please check your credentials and try again.
              </p>
            </div>
          ) : null}

          {/* Sign In Button */}
          <Button
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium mt-8"
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

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <a
              href="/register"
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </Card>
  );
}