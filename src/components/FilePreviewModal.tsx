"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ExternalLink } from "lucide-react";
import { DriveFile } from "@/lib/file-types";
import { getPreviewType } from "@/lib/file-types";
import { formatBytes } from "@/lib/utils";
import { FileIcon } from "./FileIcon";

interface FilePreviewModalProps {
  file: DriveFile | null;
  onClose: () => void;
  onDownload: (file: DriveFile) => void;
}

export function FilePreviewModal({ file, onClose, onDownload }: FilePreviewModalProps) {
  if (!file) return null;

  const previewType = getPreviewType(file.category, file.mimeType);
  const previewUrl = `/api/files/${file.id}?preview=true`;

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
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="glass w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <FileIcon category={file.category} size="sm" />
              <div className="min-w-0">
                <h2 className="text-white font-semibold truncate">{file.name}</h2>
                <p className="text-white/50 text-xs">{formatBytes(file.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDownload(file)}
                className="btn-ghost flex items-center gap-2 text-white/80 text-sm"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 min-h-[300px]">
            {previewType === "pdf" && (
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] rounded-xl border border-white/10"
                title={file.name}
              />
            )}

            {previewType === "image" && (
              <div className="flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="max-w-full max-h-[70vh] rounded-xl object-contain"
                />
              </div>
            )}

            {previewType === "video" && (
              <video
                src={previewUrl}
                controls
                className="w-full max-h-[70vh] rounded-xl"
              />
            )}

            {previewType === "audio" && (
              <div className="flex flex-col items-center justify-center py-16 gap-6">
                <FileIcon category={file.category} size="lg" />
                <audio src={previewUrl} controls className="w-full max-w-md" />
              </div>
            )}

            {previewType === "text" && (
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] rounded-xl border border-white/10 bg-white/5"
                title={file.name}
              />
            )}

            {previewType === "office" && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <FileIcon category={file.category} size="lg" />
                <p className="text-white/70 max-w-md">
                  Office documents can be opened with Microsoft Office or Google Docs.
                  Download the file to edit locally.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => onDownload(file)} className="btn-primary flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Download & Open
                  </button>
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost flex items-center gap-2 text-white/80"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Drive
                    </a>
                  )}
                </div>
              </div>
            )}

            {previewType === "none" && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <FileIcon category={file.category} size="lg" />
                <p className="text-white/70">
                  Preview not available for this file type.
                </p>
                <button onClick={() => onDownload(file)} className="btn-primary flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download File
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
