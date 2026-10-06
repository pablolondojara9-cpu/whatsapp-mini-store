"use client";

import { useEffect, useRef } from "react";

export function useChangeSignal(
  onChange: () => void,
  intervalMs = 3000
) {
  const callbackRef = useRef(onChange);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let lastVersion: string | null = null;

    const checkForChanges = async () => {
      try {
        const response = await fetch("/api/conversations/version", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No se pudo comprobar la versión");
        }

        const data = await response.json();

        console.log("VERSION:", data.version);

        if (lastVersion !== null && data.version !== lastVersion) {
          console.log("CAMBIO DETECTADO");
          callbackRef.current();
        }

        lastVersion = data.version;
      } catch (error) {
        console.error("❌ Error comprobando cambios:", error);
      }
    };

    checkForChanges();

    const interval = setInterval(checkForChanges, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [intervalMs]);
}