import React from "react";

/**
 * The dashboard's language: English by default, Chinese when the viewer switches. One switch (the
 * header's, or any panel's) sets every panel at once. Stored per viewer under "uiLang"; the old
 * "briefLang" defaulted to Chinese and is no longer read, so everyone starts in English.
 * Words the server sends in both languages ({en, zh}) are picked with the same setting.
 */
export type Lang = "en" | "zh";

const KEY = "uiLang";
const EVENT = "ui-lang-change";

export function getLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* per-viewer convenience only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: lang }));
}

/** The current language, re-rendering the component whenever any switch changes it. */
export function useLang(): [Lang, (lang: Lang) => void] {
  const [lang, set] = React.useState<Lang>(getLang);
  React.useEffect(() => {
    const sync = () => set(getLang());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);   // another tab switched
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [lang, setLang];
}

/** The English text unless the viewer chose Chinese. */
export const tr = (lang: Lang, en: string, zh: string): string => (lang === "zh" ? zh : en);

/** A bilingual value from the server, English first. */
export const pick = (lang: Lang, text?: { en?: string; zh?: string } | null): string =>
  (lang === "zh" ? text?.zh || text?.en : text?.en || text?.zh) || "";
