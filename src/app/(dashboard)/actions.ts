"use server";

import { redirect } from "next/navigation";
import { clearSession } from "@/server/auth";

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

