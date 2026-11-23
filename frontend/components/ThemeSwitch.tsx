"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { THEMES, THEME_EVENT, THEME_KEY, type ThemeChoice, applyTheme, followSavedTheme, readTheme } from "@/lib/theme";

import styles from "./SiteHeader.module.css";

type Props = {
  t: { theme: string; themeSystem: string; themeLight: string; themeDark: string };
};

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) {
      // Another tab changed it: follow along on this page too.
      followSavedTheme();
      onChange();
    }
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** A small button in the header that opens a menu: System (the default), Light or Dark. */
export function ThemeSwitch({ t }: Props) {
  // The server cannot know the choice, so it renders "system"; the browser then shows the real one.
  const choice = useSyncExternalStore(subscribe, readTheme, () => "system" as ThemeChoice);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const labels: Record<ThemeChoice, string> = { system: t.themeSystem, light: t.themeLight, dark: t.themeDark };

  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function choose(next: ThemeChoice) {
    applyTheme(next);
    setOpen(false);
    button.current?.focus();
  }

  function onMenuKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = [...(box.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.theme} ref={box}>
      <button
        ref={button}
        type="button"
        className={styles.themeButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${t.theme}: ${labels[choice]}`}
        title={`${t.theme}: ${labels[choice]}`}
        onClick={() => setOpen((value) => !value)}
      >
        <ThemeIcon choice={choice} />
      </button>
      {open && (
        <div id={menuId} className={styles.themeMenu} role="menu" aria-label={t.theme} onKeyDown={onMenuKey}>
          {THEMES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === choice}
              className={styles.themeOption}
              onClick={() => choose(option)}
            >
              <ThemeIcon choice={option} />
              <span>{labels[option]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  const common = {
    "aria-hidden": true,
    width: 20,
    height: 20,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (choice === "light") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="3.6" />
        <path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
      </svg>
    );
  }
  if (choice === "dark") {
    return (
      <svg {...common}>
        <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
      <path d="M7 17h6M10 13.5V17" />
    </svg>
  );
}
