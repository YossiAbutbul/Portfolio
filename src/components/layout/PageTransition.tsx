"use client";

import { usePathname } from "next/navigation";
import styles from "./PageTransition.module.css";

// The key remounts the wrapper on every route change, which restarts the CSS fade.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={styles.fade}>
      {children}
    </div>
  );
}
