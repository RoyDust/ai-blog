import { redirect } from "next/navigation";

export default function WritePage() {
  redirect("/admin/posts/new");
}
