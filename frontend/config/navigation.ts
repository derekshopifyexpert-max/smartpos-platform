import {
  CreditCard,
  LayoutDashboard,
  ReceiptText,
  ListChecks,
  Settings,
  Wallet,
  TrendingUp,
} from "lucide-react";

export interface NavigationItem {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  children?: NavigationItem[];
}

export const navigation: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Payments",
    href: "/dashboard/payments",
    icon: CreditCard,
  },
  {
    title: "Crypto Trading",
    href: "/dashboard/crypto",
    icon: TrendingUp,
  },
  {
    title: "Settlements",
    href: "/dashboard/settlements",
    icon: ListChecks,
  },
  {
    title: "Wallets",
    href: "/dashboard/wallets",
    icon: Wallet,
  },
  {
    title: "Transactions",
    href: "/dashboard/transactions",
    icon: ReceiptText,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];
