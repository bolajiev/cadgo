import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadgo — AI CAD part studio",
  description:
    "Turn plain language into parametric OpenSCAD parts you can edit, compile and export in the browser. Plus a jointed mechanism lab. Built for the Victoria VR AI Builder Hackathon 2026.",
  openGraph: {
    title: "Cadgo — AI CAD part studio",
    description: "Describe a part. Get real CAD.",
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
