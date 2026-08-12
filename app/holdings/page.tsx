import { redirect } from "next/navigation";

export default function HoldingsRedirectPage() {
  redirect("/money?tab=holdings");
}
