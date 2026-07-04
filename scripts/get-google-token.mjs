#!/usr/bin/env node
/**
 * Run once to get GOOGLE_OAUTH_REFRESH_TOKEN for personal Gmail storage.
 *
 * 1. Google Cloud Console → APIs → Credentials → Create OAuth Client (Desktop app)
 * 2. Add redirect URI: http://localhost:3333/oauth/callback
 * 3. Set in .env.local:
 *    GOOGLE_OAUTH_CLIENT_ID=...
 *    GOOGLE_OAUTH_CLIENT_SECRET=...
 * 4. Run: node scripts/get-google-token.mjs
 * 5. Copy refresh_token into .env.local as GOOGLE_OAUTH_REFRESH_TOKEN
 */

import { google } from "googleapis";
import http from "http";
import { URL } from "url";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3333/oauth/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive"],
});

console.log("\nOpen this URL in your browser:\n");
console.log(authUrl);
console.log("\nWaiting for authorization...\n");

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "", "http://localhost:3333");
    if (url.pathname !== "/oauth/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("Missing code");
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Success! You can close this tab and return to the terminal.</h1>");

    console.log("Add this to your .env.local:\n");
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    if (!tokens.refresh_token) {
      console.warn("No refresh_token returned. Revoke app access at https://myaccount.google.com/permissions and run again with prompt=consent.");
    }

    server.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end("Error");
    server.close();
    process.exit(1);
  }
});

server.listen(3333, () => {
  console.log("Local callback server listening on http://localhost:3333");
});
