import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const storageKey = "talca-tema";
const listeners = new Set<() => void>();

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  listeners.forEach((notify) => notify());
}

function onStorage(event: StorageEvent) {
  if (event.key === storageKey || event.key === null) {
    applyTheme(event.newValue === "oscuro" ? "dark" : "light");
  }
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(storageKey, next === "dark" ? "oscuro" : "claro");
  } catch {
    // La interfaz sigue funcionando si el navegador bloquea el almacenamiento.
  }
}

/** Una sola preferencia para todas las rutas, sin depender de la sesión. */
export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    currentTheme,
    () => "light" as const,
  );
  return { theme, toggleTheme };
}
