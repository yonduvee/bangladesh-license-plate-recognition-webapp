
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BD PlateVision | Bangladesh License Plate Recognition",
  description:
    "AI-powered Bangladeshi license plate localization and Bengali character recognition using YOLO11.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
