"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const KNOWN_SOURCES = new Set(["whatsapp", "linkedin", "facebook", "qrcode", "link", "empresa", "alerta"]);

// Registra uma visualização por sessão do navegador (robôs de prévia não executam JavaScript).
export function ViewTracker({ jobId, source }: { jobId: string; source?: string }) {
  useEffect(() => {
    const key = `trivagas:view:${jobId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Navegação privada sem sessionStorage: registra mesmo assim.
    }
    const origin = source && KNOWN_SOURCES.has(source) ? source : "direct";
    const referrer = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : null;
    // A consulta do supabase-js só é enviada quando aguardada (then).
    createClient()
      .rpc("register_job_view", { target_job: jobId, view_source: origin, view_referrer: referrer })
      .then(() => undefined);
  }, [jobId, source]);

  return null;
}
