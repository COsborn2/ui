import type { ReactNode } from "react";
import "./tailwind.css";
import "@cosborn2/ui/theme.css";
import "./fixture.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" data-bnh-theme="dark"><head><link rel="icon" href="data:," /></head><body>{children}</body></html>;
}
