import { redirect } from "next/navigation";

export default function BuyCryptoPage() {
  redirect("/dashboard/payments");
}