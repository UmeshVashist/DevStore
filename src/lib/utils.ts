import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function daysUntilPermanentDelete(deletedAt: string, retentionDays: number): number {
  const deleted = new Date(deletedAt).getTime();
  const expiresAt = deleted + retentionDays * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}
