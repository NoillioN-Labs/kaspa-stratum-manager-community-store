import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kaspa Solo Mining Console",
  description: "Manage local Kaspa solo mining from Umbrel.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#10241f",
};

const themeBootScript = `(()=>{try{const key="kaspa-stratum-manager-theme";const saved=localStorage.getItem(key);document.documentElement.dataset.theme=saved==="dark"?"dark":"light"}catch{document.documentElement.dataset.theme="light"}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
