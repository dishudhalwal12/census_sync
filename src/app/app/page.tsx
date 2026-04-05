import { redirect } from "next/navigation";

import { ROLE_HOME } from "@/lib/constants";
import { requireSession } from "@/lib/server/session";

export default async function AppIndexPage() {
  const session = await requireSession();

  redirect(ROLE_HOME[session.role]);
}
