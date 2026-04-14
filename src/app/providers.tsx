"use client";

import { I18nProvider } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      {children}
      <LanguageSwitcher />
    </I18nProvider>
  );
}
