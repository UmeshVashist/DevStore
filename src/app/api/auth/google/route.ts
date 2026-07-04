import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthRedirectUri, OAUTH_REDIRECT_COOKIE } from "@/lib/google-oauth-store";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in?redirect_url=/setup/drive", request.url));
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = getOAuthRedirectUri(request.nextUrl.origin);

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/setup/drive?error=missing_client", request.url)
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/drive",
      "openid",
      "email",
      "profile",
    ],
  });

  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_REDIRECT_COOKIE, redirectUri, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
