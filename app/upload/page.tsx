import { redirect } from "next/navigation";

export default function UploadRedirectPage() {
  redirect("/money?tab=import");
}
