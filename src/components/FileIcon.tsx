import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  HardDrive,
  Image,
  Film,
  Music,
  File,
  FileCode,
  Folder,
} from "lucide-react";
import { FileCategory } from "@/lib/file-types";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<FileCategory, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  ppt: Presentation,
  archive: FileArchive,
  software: HardDrive,
  image: Image,
  video: Film,
  audio: Music,
  text: FileCode,
  folder: Folder,
  other: File,
};

const COLOR_MAP: Record<FileCategory, string> = {
  pdf: "from-red-500 to-rose-600",
  word: "from-blue-500 to-blue-700",
  excel: "from-green-500 to-emerald-600",
  ppt: "from-orange-500 to-amber-600",
  archive: "from-yellow-500 to-orange-500",
  software: "from-purple-500 to-violet-600",
  image: "from-pink-500 to-rose-500",
  video: "from-indigo-500 to-purple-600",
  audio: "from-teal-500 to-cyan-600",
  text: "from-slate-400 to-slate-600",
  folder: "from-amber-400 to-yellow-600",
  other: "from-gray-400 to-gray-600",
};

interface FileIconProps {
  category: FileCategory;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function FileIcon({ category, className, size = "md" }: FileIconProps) {
  const Icon = ICON_MAP[category];
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };
  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md",
        COLOR_MAP[category],
        sizeClasses[size],
        className
      )}
    >
      <Icon className={cn("text-white", iconSizes[size])} />
    </div>
  );
}
