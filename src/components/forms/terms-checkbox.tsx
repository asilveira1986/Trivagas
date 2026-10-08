import Link from "next/link";

export function TermsCheckbox({ error }: { error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-4 accent-primary" />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="font-semibold text-primary hover:underline">
            termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="font-semibold text-primary hover:underline">
            política de privacidade
          </Link>
          .
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
