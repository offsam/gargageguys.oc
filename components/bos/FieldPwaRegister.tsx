"use client";

import { useEffect } from "react";

/** Registers Field service worker + ensures installable manifest is linked. */
export function FieldPwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"][data-field-pwa]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/field.webmanifest";
      link.dataset.fieldPwa = "1";
      document.head.appendChild(link);
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = "#0f2340";
      document.head.appendChild(meta);
    }

    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw-field.js", { scope: "/field/" }).catch(() => {
        /* ignore — PWA is progressive */
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
