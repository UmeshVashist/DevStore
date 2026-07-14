import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createUserFolder, listAllUserFolders } from "@/lib/google-drive";
import { formatDriveError } from "@/lib/google-auth";
import { fetchAndCacheAccounts } from "@/lib/google-oauth-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await fetchAndCacheAccounts(userId);

    const driveEmail =
      request.headers.get("x-drive-email") ||
      request.nextUrl.searchParams.get("driveEmail") ||
      undefined;

    const folders = await listAllUserFolders(userId, driveEmail);
    return NextResponse.json({ folders });
  } catch (error) {
    console.error("List folders error:", error);
    return NextResponse.json({ error: formatDriveError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await fetchAndCacheAccounts(userId);

    const driveEmail =
      request.headers.get("x-drive-email") ||
      request.nextUrl.searchParams.get("driveEmail") ||
      undefined;

    const body = await request.json();
    const name = body.name as string;
    const parentId = body.parentId as string | undefined;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    const folder = await createUserFolder(userId, name.trim(), parentId, driveEmail);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error("Create folder error:", error);
    return NextResponse.json({ error: formatDriveError(error) }, { status: 500 });
  }
}
