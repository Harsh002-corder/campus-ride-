import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { PropsWithChildren } from "react";

const ThemeProvider = ({ children }: PropsWithChildren) => {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="campusride-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
};

export default ThemeProvider;
