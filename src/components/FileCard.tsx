"use client";

import { motion } from "framer-motion";
import {
  Download,
  Trash2,
  Eye,
  MoreVertical,
  RotateCcw,
  Clock,
  Scissors,
  Copy,
  Edit2,
} from "lucide-react";
import { DriveFile } from "@/lib/file-types";
import { FileIcon } from "./FileIcon";
import { formatBytes, formatDate, daysUntilPermanentDelete } from "@/lib/utils";
import { useState } from "react";
import { RETENTION_DAYS } from "@/lib/constants";

interface FileCardProps {
  file: DriveFile;
  onPreview: (file: DriveFile) => void;
  onDownload: (file: DriveFile) => void;
  onDelete: (file: DriveFile) => void;
  onRestore?: (file: DriveFile) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onRename?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isTrash?: boolean;
  index?: number;
  selected?: boolean;
  onSelectToggle?: () => void;
  anySelected?: boolean;
  accounts?: Array<{ email: string; name?: string; connectedAt: string }>;
  showDriveBadge?: boolean;
}

export function FileCard({
  file,
  onPreview,
  onDownload,
  onDelete,
  onRestore,
  onCopy,
  onCut,
  onRename,
  onMouseEnter,
  onMouseLeave,
  isTrash = false,
  index = 0,
  selected = false,
  onSelectToggle,
  anySelected = false,
  accounts = [],
  showDriveBadge = false,
}: FileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const daysLeft = file.deletedAt
    ? daysUntilPermanentDelete(file.deletedAt, RETENTION_DAYS)
    : null;

  const driveAccount = accounts?.find(a => a.email === file.driveEmail);
  const rawDisplayName = driveAccount?.name || file.driveEmail || "";
  const driveDisplayName = rawDisplayName.includes("@")
    ? rawDisplayName.split("@")[0]
    : rawDisplayName;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`group relative border transition-all cursor-pointer p-4 rounded-2xl ${
        selected 
          ? "glass-neo-in border-indigo-500/60 shadow-indigo-500/5" 
          : "glass-neo-out hover:shadow-neumorph-out border-slate-200/40 dark:border-white/5"
      }`}
      onClick={(e) => {
        if (anySelected && onSelectToggle) {
          e.stopPropagation();
          onSelectToggle();
        } else if (!isTrash) {
          onPreview(file);
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {onSelectToggle && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelectToggle();
          }}
          className={`absolute top-2 left-2 w-5 h-5 rounded-full border transition-all flex items-center justify-center z-10 cursor-pointer ${
            selected
              ? "bg-indigo-500 border-indigo-500 text-white"
              : "border-slate-300/60 bg-white/40 dark:border-white/20 dark:bg-black/40 opacity-0 group-hover:opacity-100"
          } ${anySelected ? "opacity-100" : ""}`}
        >
          {selected && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}
      <div className="flex items-start gap-3">
        <FileIcon category={file.category} size="md" />
        <div className="flex-1 min-w-0 text-left">
          <h3 className="text-slate-800 dark:text-slate-200 font-bold truncate" title={file.name}>
            {file.name}
          </h3>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5 font-medium">
            {formatBytes(file.size)}
            {file.name.includes(".") ? ` • ${file.name.split(".").pop()?.toUpperCase()}` : ""}
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">{formatDate(file.modifiedAt)}</p>
          {showDriveBadge && file.driveEmail && (
            <div className="flex justify-end mt-1.5">
              <span className="text-[10px] text-indigo-600 bg-indigo-500/10 dark:text-indigo-300 dark:bg-indigo-500/15 px-2 py-0.5 rounded-md border border-indigo-500/20 truncate max-w-[120px] font-bold animate-fade-in" title={file.driveEmail}>
                ☁️ {driveDisplayName}
              </span>
            </div>
          )}
          {isTrash && daysLeft !== null && (
            <p className="text-amber-500 dark:text-amber-400/80 text-xs mt-1 flex items-center gap-1 font-semibold">
              <Clock className="w-3 h-3" />
              {daysLeft} days left to restore
            </p>
          )}
        </div>

        <div className="relative">
          {!anySelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </button>
          )}

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-0 top-8 z-20 glass-neo-out border border-slate-200/50 dark:border-white/5 rounded-xl py-1 min-w-[140px] shadow-xl overflow-hidden"
              >
                {!isTrash && (
                  <>
                    <ActionButton icon={Eye} label="Open" onClick={() => { onPreview(file); setMenuOpen(false); }} />
                    <ActionButton icon={Download} label="Download" onClick={() => { onDownload(file); setMenuOpen(false); }} />
                    {onCut && <ActionButton icon={Scissors} label="Cut" onClick={() => { onCut(); setMenuOpen(false); }} />}
                    {onCopy && <ActionButton icon={Copy} label="Copy" onClick={() => { onCopy(); setMenuOpen(false); }} />}
                    {onRename && <ActionButton icon={Edit2} label="Rename" onClick={() => { onRename(); setMenuOpen(false); }} />}
                    <ActionButton icon={Trash2} label="Delete" onClick={() => { onDelete(file); setMenuOpen(false); }} danger />
                  </>
                )}
                {isTrash && onRestore && (
                  <>
                    <ActionButton icon={RotateCcw} label="Restore" onClick={() => { onRestore(file); setMenuOpen(false); }} />
                    <ActionButton icon={Trash2} label="Delete Forever" onClick={() => { onDelete(file); setMenuOpen(false); }} danger />
                  </>
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>

      {!anySelected && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200/30 dark:border-white/10">
          {!isTrash ? (
            <>
              <QuickButton icon={Eye} label="Open" onClick={(e) => { e.stopPropagation(); onPreview(file); }} />
              <QuickButton icon={Download} label="Download" onClick={(e) => { e.stopPropagation(); onDownload(file); }} />
              <QuickButton icon={Trash2} label="Delete" onClick={(e) => { e.stopPropagation(); onDelete(file); }} danger />
            </>
          ) : (
            onRestore && (
              <QuickButton icon={RotateCcw} label="Restore" onClick={(e) => { e.stopPropagation(); onRestore(file); }} primary />
            )
          )}
        </div>
      )}
    </motion.div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-200/60 dark:hover:bg-white/5 transition-colors font-medium ${
        danger ? "text-red-500" : "text-slate-700 dark:text-slate-200"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );
}

function QuickButton({
  icon: Icon,
  label,
  onClick,
  danger,
  primary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={(e) => onClick(e)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
        primary
          ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/30"
          : danger
          ? "bg-red-500/5 border-red-500/10 text-red-500 hover:bg-red-500/15"
          : "bg-slate-200/40 border-slate-300/30 text-slate-600 dark:bg-white/5 dark:border-white/5 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/10"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
