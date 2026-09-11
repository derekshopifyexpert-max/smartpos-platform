import type { Metadata } from "next";

import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

export const metadata: Metadata = {
  title: "SmartPOS",
  description: "Modern Payment Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">

  <QueryProvider>

    <ThemeProvider>

      {children}

      <Toaster />

    </ThemeProvider>

  </QueryProvider>

</body>
    </html>
  );
}