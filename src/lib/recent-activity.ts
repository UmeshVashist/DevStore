"use client";

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "devdata_recent_activity_v2";
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000; // Allow 1 minute clock skew

export interface RecentStatus {
  isNew: boolean;
  isUpdated: boolean;
  hoursLeft: number;
}

/**
 * Prunes expired entries and returns map of itemId -> timestamp.
 */
export function getRecentActivityMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const updated: Record<string, number> = {};
    let changed = false;

    for (const [id, timestamp] of Object.entries(parsed)) {
      if (
        typeof timestamp === "number" &&
        now - timestamp < TWENTY_FOUR_HOURS_MS &&
        now >= timestamp - CLOCK_SKEW_TOLERANCE_MS
      ) {
        updated[id] = timestamp;
      } else {
        changed = true; // Prune expired entry
      }
    }

    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch {
    return {};
  }
}

/**
 * Record that an item was created or updated right now.
 */
export function recordRecentActivity(itemId: string) {
  if (typeof window === "undefined" || !itemId) return;
  try {
    const map = getRecentActivityMap();
    map[itemId] = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(
      new CustomEvent("devdata_recent_activity_updated", { detail: { itemId } })
    );
  } catch {}
}

/**
 * Evaluate whether an item was created or updated within the last 24 hours.
 */
export function checkRecentStatus(
  item: { id?: string; createdAt?: string; modifiedAt?: string },
  recentMap?: Record<string, number>
): RecentStatus {
  const result: RecentStatus = {
    isNew: false,
    isUpdated: false,
    hoursLeft: 0,
  };

  if (!item) return result;

  const now = Date.now();
  let mostRecentTime = 0;
  let isFromModification = false;

  // 1. Check local activity tracker
  if (item.id) {
    const map = recentMap || getRecentActivityMap();
    const localTime = map[item.id];
    if (
      localTime &&
      now - localTime < TWENTY_FOUR_HOURS_MS &&
      now >= localTime - CLOCK_SKEW_TOLERANCE_MS
    ) {
      mostRecentTime = Math.max(mostRecentTime, localTime);
      isFromModification = true;
    }
  }

  // 2. Check item's modifiedAt
  if (item.modifiedAt) {
    const modTime = new Date(item.modifiedAt).getTime();
    if (
      !isNaN(modTime) &&
      now - modTime < TWENTY_FOUR_HOURS_MS &&
      now >= modTime - CLOCK_SKEW_TOLERANCE_MS
    ) {
      if (modTime > mostRecentTime) {
        mostRecentTime = modTime;
      }
    }
  }

  // 3. Check item's createdAt
  if (item.createdAt) {
    const createTime = new Date(item.createdAt).getTime();
    if (
      !isNaN(createTime) &&
      now - createTime < TWENTY_FOUR_HOURS_MS &&
      now >= createTime - CLOCK_SKEW_TOLERANCE_MS
    ) {
      if (createTime > mostRecentTime) {
        mostRecentTime = createTime;
      }
    }
  }

  if (mostRecentTime > 0) {
    const elapsed = now - mostRecentTime;
    const remainingMs = TWENTY_FOUR_HOURS_MS - elapsed;
    if (remainingMs > 0) {
      result.isNew = true;
      result.hoursLeft = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));

      // Determine if it was an update or initial creation
      if (item.createdAt && item.modifiedAt) {
        const createT = new Date(item.createdAt).getTime();
        const modT = new Date(item.modifiedAt).getTime();
        // If modifiedAt is more than 30 seconds after createdAt, it was updated
        if (!isNaN(createT) && !isNaN(modT) && modT - createT > 30000) {
          result.isUpdated = true;
        } else {
          result.isUpdated = isFromModification;
        }
      } else {
        result.isUpdated = isFromModification;
      }
    }
  }

  return result;
}

/**
 * React hook to listen for recent activity updates and automatically re-evaluate every minute
 * so items cleanly lose their "NEW!" badge after 24 hours without page reload.
 */
export function useRecentActivity() {
  const [recentMap, setRecentMap] = useState<Record<string, number>>({});

  const refresh = useCallback(() => {
    setRecentMap(getRecentActivityMap());
  }, []);

  useEffect(() => {
    refresh();

    const handleUpdate = () => refresh();
    window.addEventListener("devdata_recent_activity_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    // Re-check every 60 seconds to auto-expire badges
    const interval = setInterval(refresh, 60000);

    return () => {
      window.removeEventListener("devdata_recent_activity_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      clearInterval(interval);
    };
  }, [refresh]);

  return recentMap;
}
