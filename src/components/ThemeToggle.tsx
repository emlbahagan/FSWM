"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);

    if (nextDark) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("theme", "dark");
      } catch {
        // ignore
      }
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("theme", "light");
      } catch {
        // ignore
      }
    }
  };

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-xl border border-[var(--line)] bg-[var(--panel)] opacity-50" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="flex w-10 h-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:text-foreground hover:border-[var(--teal)] transition shadow-2xs cursor-pointer"
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-700" />}
    </button>
  );
}
