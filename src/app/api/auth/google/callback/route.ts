import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import {
  getOAuthRedirectUri,
  saveRefreshToken,
  OAUTH_REDIRECT_COOKIE,
} from "@/lib/google-oauth-store";
import { clearGoogleAuthCache } from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const baseUrl = request.nextUrl.origin;

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/setup/drive?error=${error || "no_code"}`, baseUrl)
    );
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/setup/drive?error=missing_client", baseUrl));
  }

  const redirectUri =
    request.cookies.get(OAUTH_REDIRECT_COOKIE)?.value ||
    getOAuthRedirectUri(request.nextUrl.origin);

  let refreshTokenToPass: string | undefined = undefined;
  try {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/setup/drive?error=no_refresh_token", baseUrl));
    }
    refreshTokenToPass = tokens.refresh_token;

    oauth2.setCredentials(tokens);

    let email: string | undefined;
    try {
      const oauth2User = google.oauth2({ version: "v2", auth: oauth2 });
      const userInfo = await oauth2User.userinfo.get();
      email = userInfo.data.email || undefined;
    } catch {
      // email optional
    }

    saveRefreshToken(tokens.refresh_token, email);
    clearGoogleAuthCache();
    console.log("Google Drive connected successfully", email || "");

    const response = NextResponse.redirect(new URL("/setup/drive?success=1", baseUrl));
    response.cookies.delete(OAUTH_REDIRECT_COOKIE);
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_exchange";
    console.error("OAuth callback error:", e);

    const isErofs = msg.includes("EROFS") || msg.toLowerCase().includes("read-only");
    if (isErofs && refreshTokenToPass) {
      return NextResponse.redirect(
        new URL(`/setup/drive?error=erofs&token=${encodeURIComponent(refreshTokenToPass)}`, baseUrl)
      );
    }

    return NextResponse.redirect(
      new URL(`/setup/drive?error=${encodeURIComponent(msg)}`, baseUrl)
    );
  }
}
