import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadgo — AI 3D assembly studio",
  description:
    "Describe a part, a mechanical assembly, or a concept 3D scene. Get editable, parametric CAD with local OpenSCAD compilation, an agent that works alongside you, and standard STL/SCAD/JSON exports.",
  openGraph: {
    title: "Cadgo — AI CAD assembly studio",
    description: "From a sentence to editable parametric CAD.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#111318",
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
