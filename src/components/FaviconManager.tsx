'use client';

import { useEffect } from 'react';

export type FaviconState = 'default' | 'active' | 'warning' | 'violation';

export default function FaviconManager({ state }: { state: FaviconState }) {
  useEffect(() => {
    const iconMap: Record<FaviconState, string> = {
      default: '/icons/icon-default.svg',
      active: '/icons/icon-active.svg',
      warning: '/icons/icon-warning.svg',
      violation: '/icons/icon-violation.svg',
    };

    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    
    // Type is important for SVG
    link.type = 'image/svg+xml';
    
    // Only update if it changed
    const newHref = iconMap[state];
    if (link.href !== window.location.origin + newHref) {
      link.href = newHref;
    }
  }, [state]);

  return null;
}
