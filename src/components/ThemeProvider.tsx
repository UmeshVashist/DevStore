"use client";
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="neo" themes={["neo", "skeuo"]} enableSystem={false} disableTransitionOnChange={false}>
      {children}
    </NextThemesProvider>
  );
}
