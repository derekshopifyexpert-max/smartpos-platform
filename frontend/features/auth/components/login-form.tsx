"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
    <Card className="w-full max-w-md space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">
          SmartPOS
        </h1>

        <p className="mt-2 text-muted-foreground">
          Sign in to your account
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="email">
            Email
          </Label>

          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            autoComplete="email"
            disabled={loginMutation.isPending}
            {...register("email")}
          />

          {errors.email ? (
            <p className="text-sm text-red-500">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            Password
          </Label>

          <Input
            id="password"
            type="password"
            placeholder="********"
            autoComplete="current-password"
            disabled={loginMutation.isPending}
            {...register("password")}
          />

          {errors.password ? (
            <p className="text-sm text-red-500">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        {loginMutation.isError ? (
          <p className="text-sm text-red-600">
            Unable to sign in. Please check your credentials and try again.
          </p>
        ) : null}

        <Button
          className="w-full"
          disabled={loginMutation.isPending}
          type="submit"
        >
          {loginMutation.isPending ? (
            <>
              <Spinner />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
    </Card>
  );
}