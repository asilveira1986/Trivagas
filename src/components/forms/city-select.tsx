"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type City = { id: number; label: string };

// Campo de cidade com busca na tabela do IBGE. Envia o código IBGE no campo oculto `name`.
export function CitySelect({
  name,
  id,
  defaultValue,
  required,
  invalid,
}: {
  name: string;
  id?: string;
  defaultValue?: City | null;
  required?: boolean;
  invalid?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState(defaultValue?.label ?? "");
  const [selected, setSelected] = useState<City | null>(defaultValue ?? null);
  const [options, setOptions] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const supabase = useRef<ReturnType<typeof createClient>>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef("");

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(value: string) {
    setQuery(value);
    setSelected(null);
    clearTimeout(timer.current);
    const term = value.trim();
    latest.current = term;
    if (term.length < 2) {
      setOptions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      supabase.current ??= createClient();
      const { data } = await supabase.current.rpc("search_cities", { query: term, max_results: 8 });
      if (latest.current !== term) return;
      setOptions((data as City[] | null) ?? []);
      setHighlight(0);
      setOpen(true);
    }, 200);
  }

  function choose(city: City) {
    clearTimeout(timer.current);
    latest.current = city.label;
    setSelected(city);
    setOptions([]);
    setQuery(city.label);
    setOpen(false);
  }

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        autoComplete="off"
        placeholder="Digite sua cidade"
        className="pl-9"
        value={query}
        required={required}
        onChange={(event) => search(event.target.value)}
        onFocus={() => !selected && options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (!open || options.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlight((h) => (h + 1) % options.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((h) => (h - 1 + options.length) % options.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            choose(options[highlight]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-background py-1 shadow-lg"
        >
          {options.map((city, index) => (
            <li
              key={city.id}
              role="option"
              aria-selected={index === highlight}
              className={cn("cursor-pointer px-3 py-2 text-sm", index === highlight && "bg-muted")}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(city);
              }}
              onMouseEnter={() => setHighlight(index)}
            >
              {city.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
