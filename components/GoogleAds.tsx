/* ================================================================
 * GoogleAds — Reusable Google AdSense component
 *
 * - One-time script injection
 * - Single push per <ins> (React StrictMode safe)
 * - Graceful ad-blocker fallback
 * ================================================================ */

'use client';

import { useEffect, useRef } from 'react';

interface GoogleAdsProps {
  adClient: string;
  adSlot: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

let scriptInjected = false;

export default function GoogleAds({
  adClient,
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
  className = '',
}: GoogleAdsProps) {
  const insRef = useRef<HTMLModElement>(null);
  const isPushed = useRef(false);

  useEffect(() => {
    if (scriptInjected) return;
    if (document.querySelector('script[src*="adsbygoogle.js"]')) {
      scriptInjected = true;
      return;
    }
    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => console.warn('[GoogleAds] Script failed to load');
    document.head.appendChild(script);
    scriptInjected = true;
  }, [adClient]);

  useEffect(() => {
    if (isPushed.current) return;
    const timer = setTimeout(() => {
      if (isPushed.current) return;
      try {
        const adsbygoogle = (window.adsbygoogle = window.adsbygoogle || []);
        adsbygoogle.push({});
        isPushed.current = true;
      } catch (err) {
        console.warn('[GoogleAds] Push error:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      isPushed.current = false;
    };
  }, []);

  return (
    <div className={`google-ads-container ${className}`}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
      />
      <p className="text-[10px] text-slate-700 text-center mt-1 select-none">
        Advertisement
      </p>
    </div>
  );
}
