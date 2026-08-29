import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kaspa Stratum Manager",
  description: "Manage local Kaspa solo mining from Umbrel.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#10241f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
