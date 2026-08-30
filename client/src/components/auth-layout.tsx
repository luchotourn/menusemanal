import type { ReactNode } from "react";

/**
 * AuthLayout — the "Toldo" screen shared by login and register.
 *
 * Desktop: a striped awning panel on the left holding Francis' postcard, the
 * form breathing on cream at the right. Mobile: the stripes become a header
 * band and the postcard overlaps the top of the form.
 *
 * Copy lives in the pages; this component only owns the stage. Colors come from
 * the Positano tokens in index.css (cobalto / crema / papel / tinta / tomate).
 */
interface AuthLayoutProps {
  /** Small link above the title, e.g. "← Volver al inicio". */
  backHref?: string;
  backLabel?: string;
  /** Jost caps title, e.g. "Hola de nuevo". */
  title: string;
  /** One-line hint under the title. */
  hint?: string;
  children: ReactNode;
  /** Fine print under the form (terms notice, alternate action). */
  footer?: ReactNode;
}

export function AuthLayout({
  backHref = "/",
  backLabel = "← Volver al inicio",
  title,
  hint,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-crema text-tinta font-sans grid grid-cols-1 md:grid-cols-[46%_54%]">
      {/* Toldo panel */}
      <aside
        className="bg-toldo relative flex items-end md:items-center justify-center px-6 pt-16 pb-0 md:p-10 min-h-[240px] md:min-h-screen rounded-b-[28px] md:rounded-none"
        aria-hidden="true"
      >
        <div className="bg-papel rounded-[22px] shadow-[0_18px_50px_rgba(18,54,108,0.18)] px-5 pt-4 pb-4 md:px-6 md:pt-6 md:pb-5 flex flex-col items-center gap-2 translate-y-12 md:translate-y-0">
          <picture>
            <source srcSet="/brand/francis.webp" type="image/webp" />
            <img
              src="/brand/francis.png"
              alt=""
              width={200}
              height={187}
              className="w-[120px] md:w-[200px] h-auto"
            />
          </picture>
          <span className="font-display font-semibold uppercase tracking-[0.22em] text-[15px] md:text-[20px] text-cobalto">
            Menú Semanal
          </span>
          <svg width="64" height="12" viewBox="0 0 64 12" fill="none" aria-hidden="true" className="mt-1">
            <path
              d="M2 6 Q10 -2 18 6 T34 6 T50 6 T62 6"
              stroke="#1F4FA3"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </aside>

      {/* Form side */}
      <main className="flex items-center justify-center px-6 pt-20 pb-10 md:px-14 md:py-12">
        <div className="w-full max-w-[420px] space-y-6">
          <a href={backHref} className="text-sm font-semibold text-cobalto hover:underline">
            {backLabel}
          </a>
          <div>
            <h1 className="font-display font-semibold uppercase tracking-[0.14em] text-[22px] md:text-[26px] leading-tight text-cobalto">
              {title}
            </h1>
            {hint ? <p className="mt-1.5 text-[15px] text-muted-foreground">{hint}</p> : null}
          </div>
          {children}
          {footer ? <div className="text-xs text-center text-muted-foreground leading-relaxed">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

/** Fine print under the auth forms, with real links to the legal pages. */
export function LegalNotice({ action }: { action: string }) {
  return (
    <p>
      {action} aceptás los{" "}
      <a href="/terminos" className="font-semibold text-cobalto hover:underline">
        términos y condiciones
      </a>{" "}
      y la{" "}
      <a href="/privacidad" className="font-semibold text-cobalto hover:underline">
        política de privacidad
      </a>
      .
    </p>
  );
}

/** Shared field styles so login/register inputs match the mockup exactly. */
export const authInputClass =
  "h-12 rounded-xl px-4 text-base bg-papel border-[1.5px] border-cobalto/45 focus-visible:border-cobalto focus-visible:ring-4 focus-visible:ring-cielo focus-visible:ring-offset-0 placeholder:text-muted-foreground";

export const authLabelClass = "text-[13px] font-bold text-tinta";

export const authPrimaryButtonClass =
  "w-full h-12 rounded-full bg-tomate hover:bg-tomate/90 text-white font-bold text-[15px] shadow-[0_6px_16px_rgba(227,58,44,0.28)] disabled:opacity-45 disabled:shadow-none transition-all";
