"use client";
import { useState } from "react";
import { DriveFolder } from "@/lib/file-types";
import { Folder, RotateCcw, Trash2, Clock, MoreVertical, Scissors, Copy, FolderOpen, Edit2 } from "lucide-react";
import { FileIcon } from "./FileIcon";
import { formatDate, daysUntilPermanentDelete } from "@/lib/utils";
import { motion } from "framer-motion";
import { RETENTION_DAYS } from "@/lib/constants";

interface FolderCardProps {
  folder: DriveFolder;
  onOpen: (folder: DriveFolder) => void;
  onDelete?: (folder: DriveFolder) => void;
  onRestore?: (folder: DriveFolder) => void;
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

export function FolderCard({
  folder,
  onOpen,
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
}: FolderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const daysLeft = folder.deletedAt
    ? daysUntilPermanentDelete(folder.deletedAt, RETENTION_DAYS)
    : null;

  const driveAccount = accounts?.find(a => a.email === folder.driveEmail);
  const rawDisplayName = driveAccount?.name || folder.driveEmail || "";
  const driveDisplayName = rawDisplayName.includes("@")
    ? rawDisplayName.split("@")[0]
    : rawDisplayName;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`group cursor-pointer relative border transition-all p-4 rounded-2xl ${
        selected 
          ? "glass-neo-in border-indigo-500/60 shadow-indigo-500/5" 
          : "glass-neo-out hover:shadow-neumorph-out border-slate-200/40 dark:border-white/5"
      }`}
      onClick={(e) => {
        if (anySelected && onSelectToggle) {
          e.stopPropagation();
          onSelectToggle();
        } else if (!isTrash) {
          onOpen(folder);
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
        <FileIcon category="folder" size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="text-slate-800 dark:text-slate-200 font-bold truncate" title={folder.name}>
            {folder.name}
          </h3>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
            {formatDate(folder.modifiedAt)}
            {folder.fileCount !== undefined && ` • ${folder.fileCount} file${folder.fileCount === 1 ? "" : "s"}`}
          </p>
          {isTrash && daysLeft !== null && (
            <p className="text-amber-500 dark:text-amber-400/80 text-xs mt-1 flex items-center gap-1 font-semibold">
              <Clock className="w-3 h-3" />
              {daysLeft} days left to restore
            </p>
          )}
        </div>

        <div className="relative">
          {!anySelected && !isTrash && (onDelete || onCopy || onCut) && (
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
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-0 top-8 z-20 glass-neo-out border border-slate-200/50 dark:border-white/5 rounded-xl py-1 min-w-[140px] shadow-xl overflow-hidden"
              >
                <ActionButton
                  icon={FolderOpen}
                  label="Open"
                  onClick={() => {
                    onOpen(folder);
                    setMenuOpen(false);
                  }}
                />
                {onCut && (
                  <ActionButton
                    icon={Scissors}
                    label="Cut"
                    onClick={() => {
                      onCut();
                      setMenuOpen(false);
                    }}
                  />
                )}
                {onCopy && (
                  <ActionButton
                    icon={Copy}
                    label="Copy"
                    onClick={() => {
                      onCopy();
                      setMenuOpen(false);
                    }}
                  />
                )}
                {onRename && (
                  <ActionButton
                    icon={Edit2}
                    label="Rename"
                    onClick={() => {
                      onRename();
                      setMenuOpen(false);
                    }}
                  />
                )}
                {onDelete && (
                  <ActionButton
                    icon={Trash2}
                    label="Delete"
                    onClick={() => {
                      onDelete(folder);
                      setMenuOpen(false);
                    }}
                    danger
                  />
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>
      {!anySelected && (
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-200/30 dark:border-white/10">
          {isTrash && onRestore ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore(folder);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 transition-all border border-indigo-500/20"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <Folder className="w-3.5 h-3.5 text-indigo-500/60" />
              Click to open
            </div>
          )}
          {showDriveBadge && folder.driveEmail && (
            <span className="text-[10px] text-indigo-600 bg-indigo-500/10 dark:text-indigo-300 dark:bg-indigo-500/15 px-2 py-0.5 rounded-md border border-indigo-500/20 truncate max-w-[120px] shrink-0 font-bold" title={folder.driveEmail}>
              ☁️ {driveDisplayName}
            </span>
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
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-200/60 dark:hover:bg-white/5 transition-colors text-left font-medium ${
        danger ? "text-red-500" : "text-slate-700 dark:text-slate-200"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );
}
