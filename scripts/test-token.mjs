import { google } from "googleapis";

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!clientEmail || !privateKey) {
  console.error("Missing Google credentials in process.env");
  process.exit(1);
}

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

try {
  console.log("Getting access token...");
  const tokenInfo = await auth.getAccessToken();
  console.log("Success! Access token retrieved:", tokenInfo.token ? "YES (hidden)" : "NO");
  console.log("Token response keys:", Object.keys(tokenInfo));
  console.log("Token value length:", tokenInfo.token?.length);
} catch (err) {
  console.error("Error getting access token:", err);
}
