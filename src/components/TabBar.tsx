"use client";

import { motion } from "framer-motion";
import { Files, FolderOpen, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardTab = "files" | "folders" | "trash";

interface TabBarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  fileCount: number;
  folderCount: number;
  trashCount: number;
}

export function TabBar({
  activeTab,
  onTabChange,
  fileCount,
  folderCount,
  trashCount,
}: TabBarProps) {
  const tabs = [
    { id: "files" as const, label: "My Files", icon: Files, count: fileCount },
    { id: "folders" as const, label: "Folders", icon: FolderOpen, count: folderCount },
    { id: "trash" as const, label: "Trash (30 days)", icon: Trash2, count: trashCount },
  ];

  return (
    <div className="glass-neo-in rounded-2xl p-1.5 flex gap-2 mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300",
              isActive 
                ? "text-indigo-600 dark:text-indigo-400" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white/40 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/5 shadow-[4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.3),-4px_-4px_10px_rgba(255,255,255,0.03)] rounded-xl"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative flex items-center gap-1.5 sm:gap-2">
              <Icon className={cn("w-4 h-4 shrink-0 transition-transform duration-300", isActive && "scale-110")} />
              <span className="truncate">{tab.label}</span>
              {tab.count > 0 && (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full shrink-0 transition-colors font-bold",
                  isActive 
                    ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                    : "bg-slate-300/40 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400"
                )}>
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
