"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Cloud, Database } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "./ThemeToggle";
import { APP_NAME } from "@/lib/constants";

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

export function Header() {
  const [quota, setQuota] = useState<{ limit?: string; usage?: string } | null>(null);

  useEffect(() => {
    async function fetchQuota() {
      try {
        const res = await fetch("/api/storage");
        if (res.ok) {
          const data = await res.json();
          setQuota(data.quota);
        }
      } catch (err) {
        console.error("Error fetching storage quota", err);
      }
    }
    fetchQuota();
  }, []);

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
      className="glass rounded-2xl px-6 py-4 flex items-center justify-between mb-8"
    >
      <div className="flex items-center gap-3">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg"
        >
          <Database className="w-5 h-5 text-white" />
        </motion.div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">{APP_NAME}</h1>
          <p className="text-xs text-white/60 flex items-center gap-1">
            <Cloud className="w-3 h-3" /> Google Drive Cloud Storage
          </p>
        </div>
      </div>

      {quota && (
        <div className="hidden md:flex flex-col items-center gap-1.5 max-w-xs w-full px-4">
          <div className="flex justify-between w-full text-[11px] text-white/70">
            <span>Used: <span className="font-semibold text-white">{usedText}</span> of <span className="font-semibold text-white">{limitText}</span></span>
            <span>{limitVal > 0 ? `${percentage}%` : ""}</span>
          </div>
          {limitVal > 0 && (
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden border border-white/5 relative">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-10 h-10 ring-2 ring-white/20",
            },
          }}
        />
      </div>
    </motion.header>
  );
}
