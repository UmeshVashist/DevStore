"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ArrowRightLeft } from "lucide-react";
import { DriveItem } from "@/lib/file-types";

interface MoveCrossDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DriveItem[];
  accounts: Array<{ email: string; name?: string; connectedAt: string }>;
  activeDriveEmail: string;
  onMoveComplete: () => void;
  showToast: (type: "success" | "error", message: string) => void;
}

export function MoveCrossDriveModal({
  isOpen,
  onClose,
  items,
  accounts,
  activeDriveEmail,
  onMoveComplete,
  showToast,
}: MoveCrossDriveModalProps) {
  const [selectedTargetEmail, setSelectedTargetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Determine source emails from selected items
  const sourceEmails = Array.from(
    new Set(
      items.map((item) => item.driveEmail || activeDriveEmail).filter(Boolean)
    )
  ) as string[];

  // Filter destination accounts: all accounts except the source drive emails
  const destinationAccounts = accounts.filter(
    (acc) =>
      !sourceEmails.some(
        (src) => src.toLowerCase() === acc.email.toLowerCase()
      )
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedTargetEmail("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen || items.length === 0) return null;

  const handleMove = async () => {
    if (!selectedTargetEmail) return;
    setLoading(true);
    setError("");

    try {
      const srcEmail = items[0]?.driveEmail || activeDriveEmail;
      
      const res = await fetch("/api/files/move-cross-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: items.map((i) => i.id),
          srcDriveEmail: srcEmail,
          destDriveEmail: selectedTargetEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to move items cross-drive");
      }

      showToast(
        "success",
        `Successfully moved ${items.length} item(s) to ${selectedTargetEmail}`
      );
      onMoveComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move items");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="glass w-full max-w-md rounded-2xl overflow-hidden flex flex-col p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
              <h2 className="text-white font-semibold text-lg">
                Move to Another Drive
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Description */}
          <div className="mb-4">
            <p className="text-white/70 text-sm">
              Moving <strong className="text-white">{items.length} item(s)</strong> will copy them to the target drive and delete them from the source drive.
            </p>
            {sourceEmails.length > 0 && (
              <p className="text-xs text-white/40 mt-1">
                Source Drive: <span className="text-indigo-300 font-semibold">{sourceEmails.join(", ")}</span>
              </p>
            )}
          </div>

          {/* Target Drive List (Max height constraint ensures scrollbar displays with 5+ items) */}
          <div className="space-y-2 mb-4">
            <label className="text-xs text-white/50 block">Select Target Google Account</label>
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
              {destinationAccounts.length === 0 ? (
                <p className="text-sm text-white/40 py-6 text-center italic bg-white/5 rounded-xl border border-white/5">
                  No other connected Google Drive accounts found.
                </p>
              ) : (
                destinationAccounts.map((acc) => {
                  const driveDisplayName = acc.name || acc.email;
                  const isSelected = selectedTargetEmail === acc.email;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => setSelectedTargetEmail(acc.email)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-300 font-semibold shadow-inner"
                          : "bg-white/5 hover:bg-white/10 border-white/5 text-white/90"
                      }`}
                      disabled={loading}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold truncate">{driveDisplayName}</span>
                        <span className="text-xs text-white/40 truncate">{acc.email}</span>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white shrink-0">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs mb-4 font-medium">{error}</p>}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost px-4 py-2 text-sm text-white/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMove}
              disabled={loading || !selectedTargetEmail}
              className="btn-primary px-5 py-2 text-sm flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Moving..." : "Move Items"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
