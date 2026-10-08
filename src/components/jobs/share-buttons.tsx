"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const withSource = (url: string, source: string) => `${url}${url.includes("?") ? "&" : "?"}origem=${source}`;

export function CopyLinkButton({ url, className, label = "Copiar link" }: { url: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(withSource(url, "link"));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Link copiado" : label}
    </Button>
  );
}

// Botões de compartilhamento; cada canal leva ?origem= para a contagem de visualizações.
export function ShareButtons({ url, text, className }: { url: string; text: string; className?: string }) {
  const channels = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${withSource(url, "whatsapp")}`)}`,
      className: "bg-[#25D366] text-white hover:bg-[#1ebe5b]",
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(withSource(url, "linkedin"))}`,
      className: "bg-[#0A66C2] text-white hover:bg-[#0958a8]",
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(withSource(url, "facebook"))}`,
      className: "bg-[#1877F2] text-white hover:bg-[#0f68dc]",
    },
  ];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {channels.map((channel) => (
        <Button key={channel.label} asChild size="sm" className={channel.className}>
          <a href={channel.href} target="_blank" rel="noopener noreferrer">
            {channel.label}
          </a>
        </Button>
      ))}
      <CopyLinkButton url={url} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="sm:hidden"
        onClick={() => navigator.share?.({ title: text, url: withSource(url, "link") }).catch(() => {})}
      >
        <Share2 /> Mais
      </Button>
    </div>
  );
}
