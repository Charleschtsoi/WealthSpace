import { redirect } from "next/navigation";

export default function AccountsRedirectPage() {
  redirect("/money?tab=accounts");
}
