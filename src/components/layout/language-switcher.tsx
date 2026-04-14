"use client";

import { useI18n } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      onClick={() => setLocale(locale === "en" ? "ja" : "en")}
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-sm font-medium shadow-lg transition-all hover:shadow-xl hover:bg-muted active:scale-95"
    >
      <Globe className="h-4 w-4 text-muted-foreground" />
      <span className="text-foreground">
        {locale === "en" ? "日本語" : "English"}
      </span>
    </button>
  );
}
