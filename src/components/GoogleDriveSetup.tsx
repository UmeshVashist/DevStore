"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Copy, Check } from "lucide-react";

export function GoogleDriveBanner() {
  const [status, setStatus] = useState<{
    connected: boolean;
    hasClientCredentials: boolean;
    authMode?: "oauth" | "service_account";
    loading: boolean;
  }>({ connected: false, hasClientCredentials: false, loading: true });

  useEffect(() => {
    fetch("/api/drive/status")
      .then((r) => r.json())
      .then((data) =>
        setStatus({
          connected: data.connected,
          hasClientCredentials: data.hasClientCredentials,
          authMode: data.authMode,
          loading: false,
        })
      )
      .catch(() => setStatus((s) => ({ ...s, loading: false })));
  }, []);

  if (status.loading || (status.connected && status.authMode === "oauth")) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 mb-6 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center gap-3"
    >
      <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
      <div className="flex-1">
        <p className="text-white font-medium">Pls Gmail connect (Only 1 time)</p>
        <p className="text-white/60 text-sm mt-0.5">
          Personal Gmail par upload ke liye apna account connect karna zaroori hai. Ek baar ke baad auto chalega.
        </p>
      </div>
      <Link href="/setup/drive" className="btn-primary whitespace-nowrap text-sm px-4 py-2">
        Connect Drive
      </Link>
    </motion.div>
  );
}

function SetupContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const error = searchParams.get("error");

  const [status, setStatus] = useState<{
    connected: boolean;
    hasClientCredentials: boolean;
    authMode?: "oauth" | "service_account";
    email?: string;
    loading: boolean;
  }>({ connected: false, hasClientCredentials: false, loading: true });

  const [redirectUri, setRedirectUri] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRedirectUri(`${window.location.origin}/api/auth/google/callback`);
  }, []);

  useEffect(() => {
    fetch("/api/drive/status")
      .then((r) => r.json())
      .then((data) =>
        setStatus({
          connected: data.connected,
          hasClientCredentials: data.hasClientCredentials,
          authMode: data.authMode,
          email: data.email,
          loading: false,
        })
      )
      .catch(() => setStatus((s) => ({ ...s, loading: false })));
  }, [success]);

  const copyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status.loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="glass rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Connect Google Drive</h1>
          <p className="text-white/60 text-sm mb-6">
            Apna Gmail connect karein taaki files upload ho sakein.
          </p>

          {success && status.connected && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/20 text-green-300 mb-4 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              Connected{status.email ? ` as ${status.email}` : ""}! Ab upload kar sakte hain.
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/20 text-red-300 mb-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  {error === "missing_client" && "Client ID / Secret .env.local mein add karein."}
                  {error === "no_refresh_token" &&
                    "Refresh token nahi mila. Google Account → Security → Third-party access se app revoke karke dubara try karein."}
                  {error === "no_code" && "Google se code nahi aaya. Dubara Connect click karein."}
                  {error.includes("redirect_uri_mismatch") &&
                    "Redirect URI galat hai. Neeche wala URI Google Cloud Console mein add karein."}
                  {!["missing_client", "no_refresh_token", "no_code"].includes(error) &&
                    !error.includes("redirect_uri_mismatch") &&
                    decodeURIComponent(error)}
                </div>
              </div>
            </div>
          )}

          {status.connected && status.authMode === "oauth" ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-green-400 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Drive Connected
                </p>
                {status.email && <p className="text-white/60 text-sm mt-1">{status.email}</p>}
              </div>
              <Link href="/" className="btn-primary block text-center">
                Dashboard par jayein
              </Link>
              <a
                href="/api/auth/google"
                className="btn-ghost block text-center text-white/70 py-2"
              >
                Connect Different Account
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {status.authMode === "service_account" && (
                <div className="p-3 rounded-xl bg-amber-500/20 text-amber-300 text-sm border border-amber-500/30">
                  Service Account detect hua hai (folders creation ke liye). Lekin personal Gmail par files upload karne ke liye neeche button se <strong>Connect Google Drive</strong> karein.
                </div>
              )}

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 text-sm text-white/70">
                <p className="font-medium text-white">Google Cloud Console steps:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    <a
                      href="https://console.cloud.google.com/apis/credentials/consent"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-300 underline"
                    >
                      OAuth consent screen
                    </a>
                    → App name set karein → <strong className="text-white">Test users</strong> mein
                    apna Gmail add karein
                  </li>
                  <li>
                    Credentials → OAuth Client → <strong className="text-white">Authorized redirect
                    URIs</strong> mein ye add karein:
                  </li>
                </ol>
                {redirectUri && (
                  <div className="flex items-center gap-2 bg-black/30 rounded-lg p-2">
                    <code className="text-indigo-300 text-xs flex-1 break-all">{redirectUri}</code>
                    <button
                      onClick={copyRedirect}
                      className="p-1.5 rounded hover:bg-white/10 shrink-0"
                      title="Copy"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-white/60" />
                      )}
                    </button>
                  </div>
                )}
                <p className="text-xs text-white/50">
                  Also add: http://localhost:3000/api/auth/google/callback
                </p>
              </div>

              {status.hasClientCredentials ? (
                <p className="text-green-400 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Client ID & Secret detected in .env.local
                </p>
              ) : (
                <p className="text-amber-400 text-sm">
                  Client ID & Secret .env.local mein nahi mile.
                </p>
              )}

              <a
                href="/api/auth/google"
                className={`btn-primary block text-center py-3 ${!status.hasClientCredentials ? "opacity-50 pointer-events-none" : ""}`}
              >
                Connect Google Drive
              </a>

              <Link href="/" className="btn-ghost block text-center text-white/70 py-2">
                Back to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GoogleDriveSetupPage() {
  return <SetupContent />;
}
