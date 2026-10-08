// Gera a migração com estados e municípios do IBGE (com latitude e longitude).
// Fonte: https://github.com/kelvins/municipios-brasileiros (dados públicos do IBGE).
// Uso: node scripts/generate-cities-migration.mjs
import { writeFile } from "node:fs/promises";

const BASE = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv";
const OUTPUT = new URL(
  "../supabase/migrations/20261008000700_ibge_states_and_cities.sql",
  import.meta.url,
);
const REGION_IDS = { Norte: 1, Nordeste: 2, Sudeste: 3, Sul: 4, "Centro-Oeste": 5 };

async function readCsv(file) {
  const response = await fetch(`${BASE}/${file}`);
  if (!response.ok) throw new Error(`Falha ao baixar ${file}: ${response.status}`);
  const [header, ...lines] = (await response.text())
    .replace(/^﻿/, "")
    .trim()
    .split(/\r?\n/);
  const columns = header.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    if (values.length !== columns.length) throw new Error(`Linha inesperada em ${file}: ${line}`);
    return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
  });
}

const text = (value) => `'${value.replaceAll("'", "''")}'`;
const number = (value) => {
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error(`Número inválido: ${value}`);
  return value;
};

const states = await readCsv("estados.csv");
const cities = await readCsv("municipios.csv");

const stateRows = states
  .sort((a, b) => a.codigo_uf - b.codigo_uf)
  .map((s) => {
    const region = REGION_IDS[s.regiao];
    if (!region) throw new Error(`Região desconhecida: ${s.regiao}`);
    return `  (${number(s.codigo_uf)}, ${text(s.uf)}, ${text(s.nome)}, ${region})`;
  });

const cityRows = cities
  .sort((a, b) => a.codigo_ibge - b.codigo_ibge)
  .map(
    (c) =>
      `  (${number(c.codigo_ibge)}, ${text(c.nome)}, ${number(c.codigo_uf)}, ${number(c.latitude)}, ${number(c.longitude)}, ${c.capital === "1"})`,
  );

const sql = `-- Trivagas · Fase 0 · Estados e municípios do IBGE (${cityRows.length} municípios)
-- Arquivo gerado por scripts/generate-cities-migration.mjs. Não editar à mão.

insert into public.states (code, uf, name, region_id) values
${stateRows.join(",\n")}
on conflict (code) do update set uf = excluded.uf, name = excluded.name, region_id = excluded.region_id;

insert into public.cities (id, name, state_code, latitude, longitude, is_capital) values
${cityRows.join(",\n")}
on conflict (id) do update
set name = excluded.name,
    state_code = excluded.state_code,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    is_capital = excluded.is_capital;
`;

await writeFile(OUTPUT, sql);
console.log(`${stateRows.length} estados e ${cityRows.length} municípios gravados em ${OUTPUT.pathname}`);
