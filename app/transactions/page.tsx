import { redirect } from "next/navigation";

export default function TransactionsRedirectPage() {
  redirect("/money?tab=transactions");
}
