import {
  CreditCard,
  LayoutDashboard,
  ReceiptText,
  Settings,
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
