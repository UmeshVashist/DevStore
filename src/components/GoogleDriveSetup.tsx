"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Copy, Check, Edit3 } from "lucide-react";

export function GoogleDriveBanner() {
  const [status, setStatus] = useState<{
    connected: boolean;
    hasClientCredentials: boolean;
    authMode?: "oauth" | "service_account";
    loading: boolean;
  }>({ connected: false, hasClientCredentials: false, loading: true });

  useEffect(() => {
    fetch(`/api/drive/status?t=${Date.now()}`, { cache: "no-store" })
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
        <h4 className="text-white font-medium">Google Drive Not Connected</h4>
        <p className="text-white/60 text-xs mt-0.5">
          OAuth authentication mode active hai. Files access aur upload karne ke liye apna Google Account connect karein.
        </p>
      </div>
      <Link
        href="/setup/drive"
        className="text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-[#0f0c1b] px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap self-end sm:self-center"
      >
        Connect Now
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
    accounts?: Array<{ email: string; name?: string; connectedAt: string }>;
    loading: boolean;
  }>({ connected: false, hasClientCredentials: false, loading: true });

  const [redirectUri, setRedirectUri] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // States for renaming account alias
  const [selectedRenameAccount, setSelectedRenameAccount] = useState<{ email: string; name?: string } | null>(null);
  const [newAccountAlias, setNewAccountAlias] = useState("");

  useEffect(() => {
    setRedirectUri(`${window.location.origin}/api/auth/google/callback`);
  }, []);

  useEffect(() => {
    fetch(`/api/drive/status?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) =>
        setStatus({
          connected: data.connected,
          hasClientCredentials: data.hasClientCredentials,
          authMode: data.authMode,
          email: data.email,
          accounts: data.accounts,
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

  const copyToken = () => {
    const token = searchParams.get("token");
    if (token) {
      navigator.clipboard.writeText(token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  if (status.loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center relative">
      <div className="w-full max-w-lg">
        <div className="glass-neo-out rounded-2xl p-8 border border-slate-200/50 dark:border-white/5">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-2">Connect Google Drive</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">
            Apna Gmail connect karein taaki files upload ho sakein.
          </p>

          {success && status.connected && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-300 border border-green-500/20 mb-4 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              Connected successfully! Ab upload kar sakte hain.
            </div>
          )}

          {error && (
            <div className={`p-4 rounded-xl mb-4 text-sm ${error === "erofs" ? "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20" : "bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20"}`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="w-full font-medium">
                  {error === "missing_client" && "Client ID / Secret .env.local mein add karein."}
                  {error === "no_refresh_token" &&
                    "Refresh token nahi mila. Google Account → Security → Third-party access se app revoke karke dubara try karein."}
                  {error === "no_code" && "Google se code nahi aaya. Dubara Connect click karein."}
                  {error.includes("redirect_uri_mismatch") &&
                    "Redirect URI galat hai. Neeche wala URI Google Cloud Console mein add karein."}
                  {error === "erofs" && (
                    <div className="space-y-3">
                      <p className="font-bold text-amber-600 dark:text-amber-400">Read-Only Filesystem Detected (Vercel/Serverless)</p>
                      <p>Hum token ko server ki disk par save nahi kar sakte kyunki Vercel read-only hai.</p>
                      <p>Apne Google account ko connect rakhne ke liye neeche diye gaye Refresh Token ko copy karein aur use apne Vercel Project ke dashboard par environment variable <strong>GOOGLE_OAUTH_REFRESH_TOKEN</strong> ke roop mein add karein:</p>
                      <div className="flex items-center gap-2 bg-slate-200/60 dark:bg-black/45 rounded-lg p-2 mt-1 border border-slate-300/30 dark:border-white/5 shadow-inner">
                         <code className="text-amber-700 dark:text-amber-200 text-xs flex-1 break-all select-all">{searchParams.get("token")}</code>
                        <button
                          onClick={copyToken}
                          className="p-1.5 rounded hover:bg-slate-200/60 dark:hover:bg-white/10 shrink-0"
                          title="Copy Token"
                        >
                          {copiedToken ? (
                            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-500 dark:text-white/60" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-white/40 mt-1">Add karne ke baad Vercel par project redeploy/rebuild karein.</p>
                    </div>
                  )}
                  {!["missing_client", "no_refresh_token", "no_code", "erofs"].includes(error) &&
                    !error.includes("redirect_uri_mismatch") &&
                    decodeURIComponent(error)}
                </div>
              </div>
            </div>
          )}

          {status.connected && status.authMode === "oauth" ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl glass-neo-in border border-slate-200/40 dark:border-white/5 space-y-4">
                <p className="text-green-600 dark:text-green-400 font-bold flex items-center gap-2 border-b border-slate-200/30 dark:border-white/10 pb-2">
                  <CheckCircle2 className="w-5 h-5" /> Connected Accounts
                </p>
                {status.accounts && status.accounts.length > 0 ? (
                  <div className="space-y-3">
                    {status.accounts.map((acc) => (
                      <div key={acc.email} className="flex items-center justify-between gap-2 p-3 rounded-lg glass-neo-out border border-slate-200/30 dark:border-white/5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-800 dark:text-white text-sm font-bold truncate">
                              {acc.name || acc.email}
                            </span>
                            {acc.name && acc.name !== acc.email && (
                              <span className="text-slate-400 dark:text-slate-500 text-[10px] truncate">
                                ({acc.email})
                              </span>
                            )}
                          </div>
                          {acc.connectedAt && acc.connectedAt !== "env" && (
                            <p className="text-slate-400 dark:text-slate-500 text-[10px] mt-0.5">
                              Connected: {new Date(acc.connectedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedRenameAccount(acc);
                              setNewAccountAlias(acc.name || acc.email);
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                            title="Edit Alias"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Disconnect ${acc.email}?`)) {
                                try {
                                  const res = await fetch("/api/drive/disconnect", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ email: acc.email }),
                                  });
                                  if (res.ok) {
                                    window.location.reload();
                                  } else {
                                    const data = await res.json();
                                    alert(data.error || "Failed to disconnect");
                                  }
                                } catch {
                                  alert("Failed to disconnect");
                                }
                              }
                            }}
                            className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300 px-2.5 py-1.5 rounded-lg transition-all border border-red-500/20 font-bold"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  status.email && <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">{status.email}</p>
                )}
              </div>
              <Link href="/" className="btn-primary block text-center shadow-neumorph-btn hover:shadow-neumorph-out py-3">
                Dashboard par jayein
              </Link>
              <a
                href="/api/auth/google"
                className="glass-neo-btn block text-center w-full py-3 rounded-xl border border-slate-200/50 dark:border-white/10"
              >
                + Connect Another Account
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {status.authMode === "service_account" && (
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300 text-sm border border-amber-500/20 font-medium">
                  Service Account detect hua hai (folders creation ke liye). Lekin personal Gmail par files upload karne ke liye neeche button se <strong>Connect Google Drive</strong> karein.
                </div>
              )}

              <div className="p-4 rounded-xl glass-neo-in border border-slate-200/40 dark:border-white/5 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p className="font-bold text-slate-800 dark:text-white">Google Cloud Console steps:</p>
                <ol className="list-decimal list-inside space-y-2 font-medium">
                  <li>
                    <a
                      href="https://console.cloud.google.com/apis/credentials/consent"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-300 underline"
                    >
                      OAuth consent screen
                    </a>
                    → App name set karein → <strong className="text-slate-800 dark:text-white">Test users</strong> mein
                    apna Gmail add karein
                  </li>
                  <li>
                    Credentials → OAuth Client → <strong className="text-slate-800 dark:text-white">Authorized redirect
                    URIs</strong> mein ye add karein:
                  </li>
                </ol>
                {redirectUri && (
                  <div className="flex items-center gap-2 bg-slate-200/60 dark:bg-black/30 rounded-lg p-2 border border-slate-300/40 dark:border-white/5 shadow-inner">
                    <code className="text-indigo-600 dark:text-indigo-300 text-xs flex-1 break-all select-all font-mono">{redirectUri}</code>
                    <button
                      onClick={copyRedirect}
                      className="p-1.5 rounded hover:bg-slate-200/60 dark:hover:bg-white/10 shrink-0"
                      title="Copy"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-500 dark:text-white/60" />
                      )}
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-400 dark:text-white/50">
                  Also add: http://localhost:3000/api/auth/google/callback
                </p>
              </div>

              {status.hasClientCredentials ? (
                <p className="text-green-600 dark:text-green-400 text-sm flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Client ID & Secret detected in .env.local
                </p>
              ) : (
                <p className="text-amber-600 dark:text-amber-400 text-sm font-semibold">
                  Client ID & Secret .env.local mein nahi mile.
                </p>
              )}

              <a
                href="/api/auth/google"
                className={`btn-primary block text-center py-3 shadow-neumorph-btn hover:shadow-neumorph-out ${!status.hasClientCredentials ? "opacity-50 pointer-events-none" : ""}`}
              >
                Connect Google Drive
              </a>

              <Link href="/" className="glass-neo-btn block text-center w-full py-2.5 border border-slate-200/50 dark:border-white/10 rounded-xl">
                Back to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Rename Drive Dialog Popup */}
      {selectedRenameAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-neo-out border border-slate-200/50 dark:border-white/5 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative"
          >
            <h3 className="text-slate-800 dark:text-white font-bold text-lg mb-2">Rename Drive Connection</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
              Set a custom name/alias for <strong>{selectedRenameAccount.email}</strong> to identify it easily.
            </p>
            <input
              type="text"
              value={newAccountAlias}
              onChange={(e) => setNewAccountAlias(e.target.value)}
              placeholder="e.g. Work Drive, Personal Drive"
              className="glass-neo-input w-full px-4 py-2.5 text-slate-800 dark:text-white mb-4 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-200/40 dark:bg-black/20"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedRenameAccount(null)}
                className="glass-neo-btn px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200/50 dark:border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/drive/rename", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: selectedRenameAccount.email,
                        name: newAccountAlias.trim(),
                      }),
                    });
                    if (res.ok) {
                      setSelectedRenameAccount(null);
                      window.location.reload();
                    } else {
                      const data = await res.json();
                      alert(data.error || "Failed to rename");
                    }
                  } catch {
                    alert("Failed to rename");
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30"
              >
                Save Alias
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export function GoogleDriveSetupPage() {
  return <SetupContent />;
}
