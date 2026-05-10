import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export default async function PostsLayout({ children }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/posts");
  }
  return children;
}
