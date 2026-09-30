"use client";

import { useEffect, useState } from "react";
import styles from "./LaunchSections.module.css";

/** One status line for the page's small messages: copied, ejected, achievements. */
export default function LaunchToast() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer = 0;
    const onSay = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(""), 2400);
    };
    window.addEventListener("launch:say", onSay);
    return () => { clearTimeout(timer); window.removeEventListener("launch:say", onSay); };
  }, []);
  return <div className={styles.toast} data-on={message ? "" : undefined} role="status">{message}</div>;
}

export function say(message: string) {
  window.dispatchEvent(new CustomEvent("launch:say", { detail: message }));
}
