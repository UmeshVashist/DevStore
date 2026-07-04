"use client";

import { UserButton } from "@clerk/nextjs";
import { Cloud, Database } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "./ThemeToggle";
import { APP_NAME } from "@/lib/constants";

export function Header() {
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
