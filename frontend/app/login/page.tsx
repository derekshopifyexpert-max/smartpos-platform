import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#101820] p-4 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#d6a85d]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-[#2aa198]/10 blur-3xl" />
      <LoginForm />
    </main>
  );
}
