import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadgo — AI mechanism workbench",
  description:
    "Turn a plain-language brief into a parametric, jointed 3D assembly you can move, edit and export. Built for the Victoria VR AI Builder Hackathon 2026.",
  openGraph: {
    title: "Cadgo — AI mechanism workbench",
    description: "Say it. Shape it. Set it in motion.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f1eee5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
