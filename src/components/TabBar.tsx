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
    <div className="glass rounded-xl p-1 flex gap-1 mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 py-3 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors",
              isActive ? "text-white" : "text-white/50 hover:text-white/70"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white/15 rounded-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative flex items-center gap-1.5 sm:gap-2">
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
              {tab.count > 0 && (
                <span className="bg-indigo-500/40 text-indigo-200 text-xs px-1.5 py-0.5 rounded-full shrink-0">
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
