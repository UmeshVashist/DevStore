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
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isTrash?: boolean;
  index?: number;
}

export function FileCard({
  file,
  onPreview,
  onDownload,
  onDelete,
  onRestore,
  onCopy,
  onCut,
  onMouseEnter,
  onMouseLeave,
  isTrash = false,
  index = 0,
}: FileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const daysLeft = file.deletedAt
    ? daysUntilPermanentDelete(file.deletedAt, RETENTION_DAYS)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card p-4 group relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-start gap-3">
        <FileIcon category={file.category} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate" title={file.name}>
            {file.name}
          </h3>
          <p className="text-white/50 text-xs mt-0.5">{formatBytes(file.size)}</p>
          <p className="text-white/40 text-xs">{formatDate(file.modifiedAt)}</p>
          {isTrash && daysLeft !== null && (
            <p className="text-amber-400/80 text-xs mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {daysLeft} days left to restore
            </p>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4 text-white/60" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-0 top-8 z-20 glass rounded-xl py-1 min-w-[140px] shadow-xl"
              >
                {!isTrash && (
                  <>
                    <ActionButton icon={Eye} label="Open" onClick={() => { onPreview(file); setMenuOpen(false); }} />
                    <ActionButton icon={Download} label="Download" onClick={() => { onDownload(file); setMenuOpen(false); }} />
                    {onCut && <ActionButton icon={Scissors} label="Cut" onClick={() => { onCut(); setMenuOpen(false); }} />}
                    {onCopy && <ActionButton icon={Copy} label="Copy" onClick={() => { onCopy(); setMenuOpen(false); }} />}
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

      <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
        {!isTrash ? (
          <>
            <QuickButton icon={Eye} label="Open" onClick={() => onPreview(file)} />
            <QuickButton icon={Download} label="Download" onClick={() => onDownload(file)} />
            <QuickButton icon={Trash2} label="Delete" onClick={() => onDelete(file)} danger />
          </>
        ) : (
          onRestore && (
            <QuickButton icon={RotateCcw} label="Restore" onClick={() => onRestore(file)} primary />
          )
        )}
      </div>
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
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
        danger ? "text-red-400" : "text-white/80"
      }`}
    >
      <Icon className="w-4 h-4" />
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
  onClick: () => void;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
        primary
          ? "bg-indigo-500/30 text-indigo-200 hover:bg-indigo-500/50"
          : danger
          ? "hover:bg-red-500/20 text-red-300"
          : "hover:bg-white/10 text-white/70"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
