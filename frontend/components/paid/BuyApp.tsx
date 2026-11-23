"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { Lock } from "@/components/Icons";
import { type Basket, backOf, keepBasket, loadBasket, startPayment, testPaymentPath } from "@/lib/buy";
import type { Access } from "@/lib/entitlements";
import { fill, formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { type CouponQuote, applyCoupon, cleanCode, formatPrice, fullReportIncludes, unlockReport } from "@/lib/paid";
import type { ReportRequest } from "@/lib/report";
import { RequestError } from "@/lib/request";

import styles from "./Buy.module.css";
import { CheckFailed, ReportAccessProvider, useReportAccess } from "./ReportAccess";
import { SaveWithGoogle } from "./SaveWithGoogle";

export type BuyText = Dictionary["buy"];
type Props = { lang: Locale; t: BuyText; paid: Dictionary["paid"] };
type Problem = keyof BuyText["problems"];

const REFUSALS = {
  unknown: true,
  ended: true,
  wrong_report: true,
  used_up: true,
  account_limit: true,
} as const;

/** What a refused Apply, unlock or payment means for the buyer, from the backend's answer. */
export function problemOf(caught: unknown): Problem {
  if (!(caught instanceof RequestError)) return "failed";
  if (caught.status === 402) return "payment_not_available";
  if (caught.status === 429) return caught.detail?.startsWith("too many wrong codes") ? "tooMany" : "busy";
  if (caught.status === 409 && caught.detail && caught.detail in REFUSALS) return caught.detail as Problem;
  return "failed";
}

/** The report's name on the buying pages: what it is, and who it is about. */
export function reportName(report: ReportRequest, t: BuyText): string {
  if (report.kind === "hadahan") return report.name ? fill(t.hadahanFor, { name: report.name }) : t.hadahan;
  const { bride, groom } = report.match;
  return bride.name && groom.name ? fill(t.porondamFor, { bride: bride.name, groom: groom.name }) : t.porondam;
}

export function Frame({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <header className={`rise ${styles.head}`}>
        <h1 className={`display ${styles.title}`}>{title}</h1>
        {lead && <p className="soft">{lead}</p>}
      </header>
      {children}
    </main>
  );
}

/** Opened by its address, so there is no report to buy yet. */
export function NoReport({ lang, t }: { lang: Locale; t: BuyText }) {
  return (
    <Frame title={t.title}>
      <section className={`rise ${styles.card}`} data-buy-empty>
        <h2 className={`display ${styles.cardTitle}`}>{t.noneTitle}</h2>
        <p className="soft">{t.noneText}</p>
        <div className={styles.links}>
          <Link href={`/${lang}/hadahan`} className="btn btn-primary lift">
            {t.makeHadahan}
          </Link>
          <Link href={`/${lang}/porondam`} className="btn btn-outline lift">
            {t.makePorondam}
          </Link>
        </div>
      </section>
    </Frame>
  );
}

/** This tab's report, read once the page is live and again each time the page is shown. */
export function useBasket(): Basket | null | undefined {
  const [basket, setBasket] = useState<Basket | null | undefined>(undefined);
  useEffect(() => {
    // After the first paint, so the server's page and the browser's first one are the same.
    const timer = setTimeout(() => setBasket(loadBasket()));
    return () => clearTimeout(timer);
  }, []);
  return basket;
}

/**
 * The buying page (docs/23): the report, its price, a coupon or discount code, and what is left
 * to pay. Nothing left: it unlocks at once. Something left: it goes to the payment, and nothing
 * unlocks until that is paid. The server works out every amount and does every unlock.
 */
export function BuyApp({ lang, t, paid }: Props) {
  const basket = useBasket();
  if (basket === undefined) {
    return (
      <Frame title={t.title}>
        <p role="status" className="soft">
          {t.loading}
        </p>
      </Frame>
    );
  }
  if (basket === null) return <NoReport lang={lang} t={t} />;
  return (
    // A page kept alive behind another one starts over when another report is being bought.
    <ReportAccessProvider key={JSON.stringify(basket.report)} report={basket.report} kuja={basket.kuja}>
      <Order lang={lang} t={t} paid={paid} basket={basket} />
    </ReportAccessProvider>
  );
}

function Order({ lang, t, paid, basket }: Props & { basket: Basket }) {
  const { access, set } = useReportAccess();
  // The saved report's id, when the unlock here saved it.
  const [savedId, setSavedId] = useState<string | null>(null);
  const back = backOf(basket, lang);

  if (access.state === "loading" || access.state === "none") {
    return (
      <Frame title={t.title}>
        <p role="status" className="soft">
          {t.loading}
        </p>
      </Frame>
    );
  }
  if (access.state === "failed") {
    return (
      <Frame title={t.title}>
        <CheckFailed text={t.checkFailed} />
        <BackLink href={back} text={t.back} />
      </Frame>
    );
  }
  if (!access.access.paid_reports) {
    return (
      <Frame title={t.title}>
        <section className={`rise ${styles.card}`} data-buy-open>
          <p>{t.allOpen}</p>
          <Link href={back} className="btn btn-primary lift">
            {t.openReport}
          </Link>
        </section>
      </Frame>
    );
  }
  if (access.access.paid) {
    return <Unlocked lang={lang} t={t} basket={basket} account={access.access.account} savedId={savedId} />;
  }
  return (
    <Frame title={t.title} lead={t.lead}>
      <Checkout
        lang={lang}
        t={t}
        paid={paid}
        basket={basket}
        access={access.access}
        onUnlocked={(next, id) => {
          setSavedId(id);
          set(next);
        }}
      />
      <BackLink href={back} text={t.back} />
    </Frame>
  );
}

function BackLink({ href, text }: { href: string; text: string }) {
  return (
    <Link href={href} className={styles.back}>
      {text}
    </Link>
  );
}

type CheckoutProps = Props & {
  basket: Basket;
  access: Access;
  onUnlocked: (access: Access, savedId: string | null) => void;
};

function Checkout({ lang, t, paid, basket, access, onUnlocked }: CheckoutProps) {
  const router = useRouter();
  const { retry } = useReportAccess();
  const base = useId();
  const { report } = basket;
  const { price, checkout, account } = access;
  const [code, setCode] = useState("");
  // The code the quote is for. The box is replaced by it until it is removed.
  const [quote, setQuote] = useState<{ code: string; found: CouponQuote } | null>(null);
  const [problem, setProblem] = useState<{ of: "code" | "buy"; text: Problem } | null>(null);
  const [busy, setBusy] = useState<"apply" | "buy" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const remove = useRef<HTMLButtonElement>(null);
  const focusInput = useRef(false);
  useEffect(() => {
    if (quote) remove.current?.focus();
    else if (focusInput.current) input.current?.focus();
    focusInput.current = false;
  }, [quote]);

  const final = quote?.found.new_price ?? price;
  const free = final.amount === 0;

  async function apply(event: FormEvent) {
    event.preventDefault();
    const typed = cleanCode(code);
    if (!typed || busy) return;
    setBusy("apply");
    setProblem(null);
    try {
      const found = await applyCoupon(report.kind, typed);
      if (found.new_price) setQuote({ code: typed, found });
      else setProblem({ of: "code", text: found.result as Problem });
    } catch (caught) {
      setProblem({ of: "code", text: problemOf(caught) });
    } finally {
      setBusy(null);
    }
  }

  function removeCode() {
    focusInput.current = true;
    setQuote(null);
    setCode("");
    setProblem(null);
  }

  async function buy() {
    setBusy("buy");
    setProblem(null);
    try {
      if (free && quote) {
        const done = await unlockReport(report, quote.code);
        onUnlocked(done.access, done.saved?.id ?? null);
        window.scrollTo({ top: 0 });
        return;
      }
      keepBasket(basket); // for the pages the payment goes through
      const payment = await startPayment(report, quote?.code ?? null);
      router.push(testPaymentPath(lang, payment.id));
    } catch (caught) {
      const text = problemOf(caught);
      // Bought or opened somewhere else meanwhile: show that instead.
      if (caught instanceof RequestError && ["already_paid", "free_now"].includes(caught.detail ?? "")) retry();
      // The code stopped working since Apply: the price is the full one again.
      if (text in REFUSALS || text === "payment_not_available") setQuote(null);
      setProblem({ of: text in REFUSALS ? "code" : "buy", text });
      setBusy(null);
      return;
    }
    setBusy(null);
  }

  const codeProblem = problem?.of === "code" ? t.problems[problem.text] : null;
  return (
    <div className={styles.columns}>
      <section className={`rise ${styles.card}`} aria-labelledby={`${base}-report`} data-buy-report>
        <span className={styles.eyebrow}>{t.reportLabel}</span>
        <h2 id={`${base}-report`} className={`display ${styles.cardTitle}`}>
          {reportName(report, t)}
        </h2>
        {report.kind === "hadahan" && (
          <p className="soft">{fill(t.born, { date: formatDate(`${report.birth.date}T00:00:00Z`, lang) })}</p>
        )}
        <h3 className={styles.smallTitle}>{t.includesTitle}</h3>
        <ul className={styles.includes}>
          {fullReportIncludes(report, basket.kuja).map((line) => (
            <li key={line}>{paid.includes[line]}</li>
          ))}
        </ul>
      </section>

      <section className={`rise ${styles.card}`} aria-labelledby={`${base}-order`} data-buy-order>
        <h2 id={`${base}-order`} className={`display ${styles.cardTitle}`}>
          {t.orderTitle}
        </h2>

        {quote ? (
          <div className={styles.applied} data-code-applied>
            <p>
              <span className={styles.codeName}>{quote.code}</span>{" "}
              {fill(t.applied, { percent: quote.found.percent_off ?? 0 })}
            </p>
            <button ref={remove} type="button" className={styles.linkButton} onClick={removeCode} disabled={busy !== null}>
              {t.remove}
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={apply} noValidate>
            <label htmlFor={`${base}-code`} className={styles.label}>
              {t.codeLabel}
            </label>
            <div className={styles.row}>
              <input
                id={`${base}-code`}
                ref={input}
                className={styles.input}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setProblem(null);
                }}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={100}
                aria-invalid={codeProblem !== null}
                aria-describedby={codeProblem ? `${base}-problem` : undefined}
              />
              <button type="submit" className={`btn btn-outline ${styles.apply}`} disabled={busy !== null || !cleanCode(code)}>
                {busy === "apply" ? t.applying : t.apply}
              </button>
            </div>
            {codeProblem && (
              <p id={`${base}-problem`} role="alert" className={styles.error}>
                {codeProblem}
              </p>
            )}
          </form>
        )}

        <dl className={styles.sums} aria-live="polite">
          <div className={styles.sum}>
            <dt>{t.price}</dt>
            <dd data-sum="price">{formatPrice(price, lang)}</dd>
          </div>
          {quote?.found.discount && (
            <div className={styles.sum}>
              <dt>{t.discount}</dt>
              <dd data-sum="discount">{`− ${formatPrice(quote.found.discount, lang)}`}</dd>
            </div>
          )}
          <div className={`${styles.sum} ${styles.total}`}>
            <dt>{t.total}</dt>
            <dd data-sum="total">{formatPrice(final, lang)}</dd>
          </div>
        </dl>

        {free || checkout ? (
          <button
            type="button"
            className={`btn btn-primary lift ${styles.main}`}
            onClick={buy}
            disabled={busy !== null}
            aria-busy={busy === "buy"}
            data-buy-now={free ? "free" : "pay"}
          >
            {busy === "buy" ? (free ? t.unlocking : t.starting) : free ? t.unlock : fill(t.pay, { price: formatPrice(final, lang) })}
          </button>
        ) : (
          <p className={styles.note} data-buy-closed>
            <Lock size={16} /> {t.notOpen}
          </p>
        )}
        {!free && checkout === "mock" && (
          <p className={styles.note} data-test-mode>
            {t.testMode}
          </p>
        )}
        {problem?.of === "buy" && (
          <p role="alert" className={styles.error}>
            {t.problems[problem.text]}
          </p>
        )}
        {account !== "google" && (
          <p className={styles.note}>
            {t.noSignIn}{" "}
            <Link href={`/${lang}/my#sign-in`} className={styles.link}>
              {t.haveAccount}
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}

/** The report is unlocked: open it, and, for a guest, the offer to keep it with Google. */
export function Unlocked({
  lang,
  t,
  basket,
  account,
  savedId,
}: {
  lang: Locale;
  t: BuyText;
  basket: Basket;
  account: Access["account"];
  savedId: string | null;
}) {
  const open = savedId ? `/${lang}/my/${savedId}` : backOf(basket, lang);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main id="main" className={`container ${styles.page}`}>
      <section className={`rise ${styles.card} ${styles.done}`} data-buy-done>
        <span className={styles.tick}>
          <Tick />
        </span>
        <h1 ref={heading} tabIndex={-1} className={`display ${styles.title}`}>
          {t.doneTitle}
        </h1>
        <p className="soft">{fill(t.doneText, { report: reportName(basket.report, t) })}</p>
        <Link href={open} className="btn btn-primary lift" data-open-report>
          {t.openReport}
        </Link>
        {account === "google" ? (
          <p className="soft">{t.inGoogle}</p>
        ) : (
          <SaveWithGoogle lang={lang} next={open}>
            <Link href={open} className={styles.linkButton} data-skip>
              {t.skip}
            </Link>
          </SaveWithGoogle>
        )}
      </section>
    </main>
  );
}

function Tick() {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 14.5l5 5 9.5-11" />
    </svg>
  );
}
