"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Cloud, Database } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "./ThemeToggle";
import { APP_NAME } from "@/lib/constants";
import { CustomDropdown } from "./CustomDropdown";

function formatBytes(bytesStr: string | undefined): string {
  if (!bytesStr) return "0 B";
  const bytes = parseInt(bytesStr, 10);
  if (isNaN(bytes)) return "0 B";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function Header({
  activeDrive = "all",
  onActiveDriveChange,
  accounts = [],
}: {
  activeDrive?: string;
  onActiveDriveChange?: (email: string) => void;
  accounts?: Array<{ email: string; connectedAt: string; expired?: boolean }>;
}) {
  const [quota, setQuota] = useState<{ limit?: string; usage?: string } | null>(null);

  useEffect(() => {
    async function fetchQuota() {
      try {
        const baseUrl =
          activeDrive && activeDrive !== "all"
            ? `/api/storage?driveEmail=${encodeURIComponent(activeDrive)}`
            : "/api/storage?driveEmail=all";
        const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setQuota(data.quota);
        }
      } catch (err) {
        console.error("Error fetching storage quota", err);
      }
    }
    fetchQuota();
  }, [activeDrive]);

  const usageVal = quota?.usage ? parseInt(quota.usage, 10) : 0;
  const limitVal = quota?.limit ? parseInt(quota.limit, 10) : 0;
  const percentage = limitVal > 0 ? Math.min(100, Math.round((usageVal / limitVal) * 100)) : 0;
  const usedText = formatBytes(quota?.usage);
  const limitText = quota?.limit ? formatBytes(quota.limit) : "Unlimited";

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="glass-neo-out rounded-2xl px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 mb-8 relative z-50"
    >
      <div className="flex items-center gap-3 w-full md:w-auto">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0"
        >
          <Database className="w-5 h-5 text-white" />
        </motion.div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{APP_NAME}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Cloud className="w-3 h-3 text-indigo-500" /> Google Drive Cloud Storage
          </p>
        </div>
      </div>

      {quota && (
        <div className="flex flex-col items-center gap-1.5 max-w-xs w-full px-4">
          <div className="flex justify-between w-full text-[11px] text-slate-500 dark:text-slate-400">
            <span>Used: <span className="font-semibold text-slate-800 dark:text-white">{usedText}</span> of <span className="font-semibold text-slate-800 dark:text-white">{limitText}</span></span>
            <span>{limitVal > 0 ? `${percentage}%` : ""}</span>
          </div>
          {limitVal > 0 && (
            <div className="w-full h-2.5 bg-slate-200/60 dark:bg-black/30 rounded-full overflow-hidden border border-slate-300/40 dark:border-white/5 relative shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
        {accounts.length > 0 && (
          <CustomDropdown
            options={[
              { value: "all", label: "All Drives", icon: "🌐" },
              ...accounts.map((acc) => ({
                value: acc.email,
                label: acc.expired ? `${acc.email} (Expired)` : acc.email,
                icon: acc.expired ? "⚠️" : "📧",
              })),
            ]}
            value={activeDrive}
            onChange={(val) => onActiveDriveChange?.(val)}
            className="max-w-[180px] min-w-[140px] py-1.5"
          />
        )}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-10 h-10 ring-2 ring-indigo-500/20 dark:ring-white/10",
              },
            }}
          />
        </div>
      </div>
    </motion.header>
  );
}
