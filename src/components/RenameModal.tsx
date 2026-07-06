"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Edit2 } from "lucide-react";
import { DriveItem, isDriveFolder } from "@/lib/file-types";

interface RenameModalProps {
  item: DriveItem | null;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
}

export function RenameModal({ item, onClose, onRename }: RenameModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item) {
      setName(item.name);
      setError("");
    }
  }, [item]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty");
      return;
    }
    if (trimmed === item.name) {
      onClose();
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onRename(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename");
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-indigo-400" />
              <h2 className="text-white font-semibold text-lg">
                Rename {isDriveFolder(item) ? "Folder" : "File"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-white/50 block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter new name..."
                className="glass-input w-full px-4 py-2.5 text-white placeholder:text-white/40"
                autoFocus
                disabled={loading}
              />
              {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn-ghost px-4 py-2 text-sm text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="btn-primary px-5 py-2 text-sm flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Renaming..." : "Rename"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
