"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type TurnstileApi = { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Widget anti-robô da Cloudflare (renderização explícita, funciona em navegação interna).
// Sem NEXT_PUBLIC_TURNSTILE_SITE_KEY, não aparece. O token vai no campo "cf-turnstile-response".
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));

  useEffect(() => {
    if (!siteKey || !loaded || !container.current || !window.turnstile) return;
    const id = window.turnstile.render(container.current, { sitekey: siteKey, language: "pt-br", theme: "light" });
    return () => window.turnstile?.remove(id);
  }, [siteKey, loaded]);

  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
      />
      <div ref={container} className="min-h-[65px]" />
    </>
  );
}
