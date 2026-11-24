"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { saveReport } from "@/lib/account";
import { type Basket, buyPath, getPayment, loadBasket, paymentInAddress } from "@/lib/buy";
import type { Access } from "@/lib/entitlements";
import type { Locale } from "@/lib/i18n";
import { fetchAccess } from "@/lib/paid";

import styles from "./Buy.module.css";
import { type BuyText, Frame, Unlocked } from "./BuyApp";

const EVERY_MS = 2_000;
const FOR_MS = 60_000;

type View =
  | { kind: "waiting" }
  | { kind: "slow" }
  | { kind: "gone" }
  | { kind: "unpaid"; status: "failed" | "cancelled" }
  // Paid, but this tab no longer knows the report (storage was cleared).
  | { kind: "paid" }
  | { kind: "unlocked"; basket: Basket; account: Access["account"]; savedId: string | null };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Back from the payment. This page proves nothing: it asks the server what became of the payment,
 * waiting while the provider has not said, and shows the report as unlocked only when the server
 * says it is.
 */
export function PaymentDoneApp({ lang, t }: { lang: Locale; t: BuyText }) {
  const [view, setView] = useState<View>({ kind: "waiting" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    const show = (next: View) => {
      if (current) setView(next);
    };

    async function run(): Promise<void> {
      const id = paymentInAddress(window.location.search);
      if (!id) return show({ kind: "gone" });
      const until = Date.now() + FOR_MS;
      let payment = await getPayment(id);
      while (payment.status === "pending") {
        if (Date.now() >= until) return show({ kind: "slow" });
        await wait(EVERY_MS);
        if (!current) return;
        payment = await getPayment(id);
      }
      if (payment.status !== "paid") return show({ kind: "unpaid", status: payment.status });
      const basket = loadBasket();
      const access = basket && (await fetchAccess(basket.report));
      if (!basket || !access?.paid) return show({ kind: "paid" });
      // Kept in My reports as paid. If that does not work, the report is unlocked all the same.
      const savedId = await saveReport(basket.report).then(
        (saved) => saved.id,
        () => null,
      );
      show({ kind: "unlocked", basket, account: access.account, savedId });
    }

    run().catch(() => show({ kind: "gone" }));
    return () => {
      current = false;
      // The page is kept alive behind another one: shown again, it may be for another payment.
      setView({ kind: "waiting" });
    };
  }, [attempt]);

  if (view.kind === "unlocked") {
    return <Unlocked lang={lang} t={t} basket={view.basket} account={view.account} savedId={view.savedId} />;
  }
  if (view.kind === "waiting") {
    return (
      <Frame title={t.waitingTitle}>
        <p role="status" className="soft">
          {t.waiting}
        </p>
      </Frame>
    );
  }
  if (view.kind === "paid") {
    return (
      <Frame title={t.doneTitle}>
        <section className={`rise ${styles.card}`} data-payment="paid">
          <p>{t.paidElsewhere}</p>
          <Link href={`/${lang}/my`} className="btn btn-primary lift">
            {t.myReports}
          </Link>
        </section>
      </Frame>
    );
  }
  const unpaid = view.kind === "unpaid";
  const text = unpaid ? (view.status === "failed" ? t.failedText : t.cancelledText) : view.kind === "slow" ? t.slow : t.paymentGone;
  return (
    <Frame title={unpaid ? (view.status === "failed" ? t.failedTitle : t.cancelledTitle) : t.waitingTitle}>
      <section className={`rise ${styles.card}`} data-payment={unpaid ? view.status : view.kind}>
        <p role="alert">{text}</p>
        <div className={styles.links}>
          {unpaid ? (
            <Link href={buyPath(lang)} className="btn btn-primary lift">
              {t.backToOrder}
            </Link>
          ) : (
            <>
              <button
                type="button"
                className={`btn btn-primary lift ${styles.primary}`}
                onClick={() => {
                  setView({ kind: "waiting" });
                  setAttempt((count) => count + 1);
                }}
              >
                {t.checkAgain}
              </button>
              <Link href={buyPath(lang)} className={styles.linkButton}>
                {t.backToOrder}
              </Link>
            </>
          )}
        </div>
      </section>
    </Frame>
  );
}
