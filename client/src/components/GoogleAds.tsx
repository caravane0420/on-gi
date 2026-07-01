/* ================================================================
 * GoogleAds — Reusable Google AdSense unit
 *
 * The AdSense loader <script> is injected once in index.html <head>
 * (issue #10), so this component only renders an <ins> and requests a
 * single fill per mount — guarded against React StrictMode double-push.
 * ================================================================ */

import { useEffect, useRef } from 'react';

/** Publisher ID — shared across the app */
export const AD_CLIENT = 'ca-pub-8340527043375240';

interface GoogleAdsProps {
  /** Ad unit slot ID */
  adSlot: string;
  /** Ad format — 'auto', 'rectangle', 'horizontal', 'vertical' */
  adFormat?: string;
  /** Enable full-width responsive behavior */
  fullWidthResponsive?: boolean;
  /** Additional CSS classes for the wrapper div */
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export default function GoogleAds({
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
  className = '',
}: GoogleAdsProps) {
  const insRef = useRef<HTMLModElement>(null);
  const isPushed = useRef(false);

  useEffect(() => {
    if (isPushed.current) return;

    const timer = window.setTimeout(() => {
      if (isPushed.current) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isPushed.current = true;
      } catch (err) {
        console.warn('[GoogleAds] Push error (likely ad-blocker):', err);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`google-ads-container ${className}`}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
      />
      <p className="text-[10px] text-warm-400 dark:text-warm-600 text-center mt-1 select-none">
        Advertisement
      </p>
    </div>
  );
}
