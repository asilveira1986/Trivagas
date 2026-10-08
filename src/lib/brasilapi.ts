import "server-only";

export type CnpjLookup = {
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  cnae_fiscal_descricao?: string;
  municipio?: string;
  uf?: string;
};

// Consulta pública do CNPJ (Receita Federal via BrasilAPI) para apoiar a aprovação da empresa.
// Falhas e indisponibilidade retornam null: a análise segue manual.
export async function lookupCnpj(cnpj: string): Promise<CnpjLookup | null> {
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) return null;
    return (await response.json()) as CnpjLookup;
  } catch {
    return null;
  }
}
