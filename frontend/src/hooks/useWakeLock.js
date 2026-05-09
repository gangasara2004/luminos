// ── useWakeLock.js ─────────────────────────────────────────────────────────────
// Prevents screen from sleeping on iOS (via video hack) and Android (via Wake Lock API)
import { useEffect, useRef } from 'react';

export function useWakeLock(enabled = true) {
  const wakeLockRef  = useRef(null);
  const videoRef     = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    // ── Method 1: Wake Lock API (Chrome Android, Edge)
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {
          // Silently fail — fall back to video method
        }
      }
    };

    // ── Method 2: No-op video loop (iOS Safari fallback)
    const startVideoHack = () => {
      if (videoRef.current) return;
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
      // Minimal blank video data URI
      video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAs1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1MiByMjg1NCBlOWE1OTAzIC0gSC4yNjQvTVBFRy00IEFWQY==';
      document.body.appendChild(video);
      video.play().catch(() => {});
      videoRef.current = video;
    };

    requestWakeLock();
    startVideoHack();

    // Re-acquire on visibility change (iOS/Android backgrounding)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        if (videoRef.current) videoRef.current.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); }
      if (videoRef.current)    { videoRef.current.remove(); videoRef.current = null; }
    };
  }, [enabled]);
}
