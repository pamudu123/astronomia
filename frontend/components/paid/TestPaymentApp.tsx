"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { type Outcome, type Payment, buyPath, donePath, finishTestPayment, getPayment, paymentInAddress } from "@/lib/buy";
import type { Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/paid";

import styles from "./Buy.module.css";
import { type BuyText, Frame } from "./BuyApp";

type View = { kind: "loading" } | { kind: "gone" } | { kind: "ok"; payment: Payment };

/**
 * The stand-in for a payment provider's own page (backend/app/payments/mock.py), until a real one
 * is connected. It takes no money and asks for no card: the buyer picks how the payment ends, and
 * the server decides what that means. Nothing here unlocks anything.
 */
export function TestPaymentApp({ lang, t }: { lang: Locale; t: BuyText }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [failed, setFailed] = useState(false);
  const s = t.test;

  useEffect(() => {
    let current = true;
    const id = paymentInAddress(window.location.search);
    (id ? getPayment(id) : Promise.reject(new Error("no payment")))
      .then((payment) => {
        if (!current) return;
        if (payment.status === "pending") setView({ kind: "ok", payment });
        else router.replace(donePath(lang, payment.id)); // it is over
      })
      .catch(() => current && setView({ kind: "gone" }));
    return () => {
      current = false;
      // The page is kept alive behind another one: shown again, it may be for another payment.
      setView({ kind: "loading" });
      setBusy(null);
    };
  }, [lang, router]);

  if (view.kind === "loading") {
    return (
      <Frame title={s.title}>
        <p role="status" className="soft">
          {t.loading}
        </p>
      </Frame>
    );
  }
  if (view.kind === "gone") {
    return (
      <Frame title={s.title}>
        <section className={`rise ${styles.card}`} data-payment-gone>
          <p>{t.paymentGone}</p>
          <Link href={buyPath(lang)} className="btn btn-outline lift">
            {t.backToOrder}
          </Link>
        </section>
      </Frame>
    );
  }

  const { payment } = view;
  async function end(outcome: Outcome) {
    setBusy(outcome);
    setFailed(false);
    try {
      await finishTestPayment(payment.id, outcome);
      router.replace(donePath(lang, payment.id));
    } catch {
      setFailed(true);
      setBusy(null);
    }
  }

  const buttons: { outcome: Outcome; text: string; className: string }[] = [
    { outcome: "paid", text: s.approve, className: `btn btn-primary lift ${styles.primary}` },
    { outcome: "failed", text: s.decline, className: `btn btn-outline lift ${styles.outline}` },
    { outcome: "cancelled", text: s.cancel, className: styles.linkButton },
  ];
  return (
    <Frame title={s.title}>
      <section className={`rise ${styles.card} ${styles.test}`} data-test-payment>
        <p className={styles.warning} role="note">
          {s.note}
        </p>
        <dl className={styles.sums}>
          <div className={`${styles.sum} ${styles.total}`}>
            <dt>{t.total}</dt>
            <dd data-sum="total">{formatPrice(payment.amount, lang)}</dd>
          </div>
        </dl>
        <p className="soft">{s.choose}</p>
        <div className={styles.links}>
          {buttons.map(({ outcome, text, className }) => (
            <button
              key={outcome}
              type="button"
              className={className}
              onClick={() => end(outcome)}
              disabled={busy !== null}
              aria-busy={busy === outcome}
              data-test-outcome={outcome}
            >
              {text}
            </button>
          ))}
        </div>
        {failed && (
          <p role="alert" className={styles.error}>
            {t.problems.failed}
          </p>
        )}
      </section>
    </Frame>
  );
}
