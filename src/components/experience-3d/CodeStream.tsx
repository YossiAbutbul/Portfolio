"use client";

import { useEffect, useState } from "react";
import type { Chapter } from "./chapters";
import styles from "./CodeStream.module.css";

const LANG_LABEL: Record<Chapter["codeLang"], string> = {
  tsx: "tsx",
  html: "html",
  py: "python",
  c: "c",
  json: "json",
};

type Kind = "plain" | "kw" | "tag" | "str" | "cmt" | "attr" | "num";

const KEYWORDS = new Set([
  "import","from","return","async","await","def","class","for","in","const","let","var","function","if","else","new","export","default","yield",
]);

interface Tok { text: string; kind: Kind }

function tokenize(src: string, lang: Chapter["codeLang"]): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const N = src.length;
  const isAlpha = (c: string) => /[A-Za-z_]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_-]/.test(c);
  const isDigit = (c: string) => /[0-9]/.test(c);

  while (i < N) {
    const c = src[i];

    // Line comments (# for py, // for tsx/json/c/html-ish)
    if ((lang === "py" && c === "#") || (c === "/" && src[i + 1] === "/")) {
      const start = i;
      while (i < N && src[i] !== "\n") i++;
      out.push({ text: src.slice(start, i), kind: "cmt" });
      continue;
    }

    // Strings
    if (c === '"' || c === "'") {
      const quote = c;
      const start = i;
      i++;
      while (i < N && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < N) i += 2;
        else i++;
      }
      i = Math.min(N, i + 1);
      out.push({ text: src.slice(start, i), kind: "str" });
      continue;
    }

    // Tag open / close: <Name or </Name
    if (c === "<" && (isAlpha(src[i + 1]) || src[i + 1] === "/")) {
      out.push({ text: "<", kind: "plain" });
      i++;
      if (src[i] === "/") {
        out.push({ text: "/", kind: "plain" });
        i++;
      }
      const start = i;
      while (i < N && isIdent(src[i])) i++;
      if (i > start) out.push({ text: src.slice(start, i), kind: "tag" });
      continue;
    }

    // Attribute name (e.g., name=, data-x=)
    if (isAlpha(c)) {
      const start = i;
      while (i < N && isIdent(src[i])) i++;
      const word = src.slice(start, i);
      if (KEYWORDS.has(word)) {
        out.push({ text: word, kind: "kw" });
      } else if (src[i] === "=" && (src[i + 1] === '"' || src[i + 1] === "'")) {
        out.push({ text: word, kind: "attr" });
      } else {
        out.push({ text: word, kind: "plain" });
      }
      continue;
    }

    // Numbers
    if (isDigit(c) || (c === "." && isDigit(src[i + 1] || ""))) {
      const start = i;
      while (i < N && /[0-9.]/.test(src[i])) i++;
      out.push({ text: src.slice(start, i), kind: "num" });
      continue;
    }

    out.push({ text: c, kind: "plain" });
    i++;
  }

  return out;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(toks: Tok[]): string {
  return toks
    .map((t) => (t.kind === "plain" ? escape(t.text) : `<span data-h="${t.kind}">${escape(t.text)}</span>`))
    .join("");
}

export default function CodeStream({ chapter }: { chapter: Chapter }) {
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    setTyped(0);
    let i = 0;
    const target = chapter.code.length;
    const step = Math.max(2, Math.floor(target / 60));
    const id = setInterval(() => {
      i = Math.min(target, i + step);
      setTyped(i);
      if (i >= target) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [chapter]);

  const visible = chapter.code.slice(0, typed);
  const html = render(tokenize(visible, chapter.codeLang)) + '<span data-h="caret">▍</span>';

  return (
    <aside className={styles.lane} aria-label="Code lane">
      <header className={styles.head}>
        <span className={styles.dotR} />
        <span className={styles.dotY} />
        <span className={styles.dotG} />
        <span className={styles.file}>
          {chapter.id}.{chapter.codeLang}
        </span>
        <span className={styles.lang}>{LANG_LABEL[chapter.codeLang]}</span>
      </header>
      <pre className={styles.code}>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      <footer className={styles.foot}>
        <span>{Math.round((typed / chapter.code.length) * 100)}% compiled</span>
        <span className={styles.ok}>● ok</span>
      </footer>
    </aside>
  );
}
