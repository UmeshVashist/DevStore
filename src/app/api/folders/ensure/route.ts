import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ensureFolderPath } from "@/lib/google-drive";
import { formatDriveError } from "@/lib/google-auth";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const driveEmail =
      request.headers.get("x-drive-email") ||
      request.nextUrl.searchParams.get("driveEmail") ||
      undefined;

    const body = await request.json();
    const relativePath = body.relativePath as string;
    const baseFolderId = body.baseFolderId as string | undefined;

    if (!relativePath?.trim()) {
      return NextResponse.json({ error: "relativePath is required" }, { status: 400 });
    }

    // Since we handle folder levels one by one, pathParts contains exactly one folder name
    const pathParts = [relativePath.trim()];
    const folderId = await ensureFolderPath(userId, pathParts, baseFolderId, driveEmail);

    return NextResponse.json({ folderId }, { status: 200 });
  } catch (error) {
    console.error("Ensure folder error:", error);
    return NextResponse.json({ error: formatDriveError(error) }, { status: 500 });
  }
}
