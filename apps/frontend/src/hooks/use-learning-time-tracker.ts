'use client';

import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/lib/api';

interface LearningTimeTrackerOptions {
  userId?: string;
  source: string;
  minSeconds?: number;
}

/**
 * Track active time spent on learning pages (code viewing/editing) and
 * send a single session record on unmount or tab close.
 */
export function useLearningTimeTracker({
  userId,
  source,
  minSeconds = 10,
}: LearningTimeTrackerOptions) {
  const totalMsRef = useRef(0);
  const activeStartRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!userId) return;

    totalMsRef.current = 0;
    activeStartRef.current = null;
    sessionStartRef.current = Date.now();

    const startActive = () => {
      if (document.visibilityState === 'visible') {
        activeStartRef.current = Date.now();
      }
    };

    const stopActive = () => {
      if (activeStartRef.current !== null) {
        totalMsRef.current += Date.now() - activeStartRef.current;
        activeStartRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopActive();
      } else if (document.hasFocus()) {
        startActive();
      }
    };

    const handleBlur = () => stopActive();
    const handleFocus = () => startActive();

    startActive();

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      stopActive();
      const durationSec = Math.floor(totalMsRef.current / 1000);

      if (durationSec >= minSeconds) {
        const payload = {
          userId,
          durationSec,
          source,
          startedAt: new Date(sessionStartRef.current).toISOString(),
          endedAt: new Date().toISOString(),
        };

        const body = JSON.stringify(payload);
        const url = `${API_BASE_URL}/learning-time`;
        const blob = new Blob([body], { type: 'application/json' });

        if (!navigator.sendBeacon || !navigator.sendBeacon(url, blob)) {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
          }).catch((err) => {
            console.error('Failed to log learning time', err);
          });
        }
      }

      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId, source, minSeconds]);
}
