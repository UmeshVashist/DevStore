import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { refreshAccountSession } from "@/lib/google-oauth-store";

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    const authSession = await auth();
    userId = authSession.userId;
  } catch {}

  const isDev = process.env.NODE_ENV === "development";
  if (!userId && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let email: string | undefined;
  try {
    const body = await request.json();
    email = body.email;
  } catch {}

  const success = await refreshAccountSession(email, userId || undefined);
  return NextResponse.json({ success });
}
