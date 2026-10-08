"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Upload } from "lucide-react";
import { attachResumePdf, removeResumePdf } from "@/app/candidato/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { RESUME_PDF_MAX_BYTES } from "@/lib/validation/resume";

// Envia o PDF direto do navegador para o Storage (área privada do usuário), sem passar
// pelo servidor da aplicação — que na Vercel limita o corpo da requisição a 4,5 MB.
export function PdfUpload({ userId, downloadUrl }: { userId: string; downloadUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setError(null);
    if (file.type !== "application/pdf") return setError("Envie o currículo em PDF.");
    if (file.size > RESUME_PDF_MAX_BYTES) return setError("O PDF deve ter no máximo 5 MB.");

    setBusy(true);
    const path = `${userId}/curriculo-${Date.now()}.pdf`;
    const { error: uploadError } = await createClient()
      .storage.from("resumes")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      setBusy(false);
      return setError("Não foi possível enviar o arquivo. Tente novamente.");
    }
    const result = await attachResumePdf(path);
    setBusy(false);
    if (result.error) return setError(result.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {downloadUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <FileText /> Ver meu PDF
            </a>
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">Nenhum PDF anexado.</span>
        )}
        <Button type="button" size="sm" variant="outline" disabled={busy || pending} onClick={() => input.current?.click()}>
          <Upload /> {busy ? "Enviando…" : downloadUrl ? "Trocar PDF" : "Anexar PDF"}
        </Button>
        {downloadUrl && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={busy || pending}
            onClick={() => startTransition(() => removeResumePdf())}
          >
            <Trash2 /> Remover
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        className="sr-only"
        aria-label="Currículo em PDF"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <p className="text-xs text-muted-foreground">Opcional. PDF de até 5 MB, visível só para as empresas com quem você compartilhar.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
