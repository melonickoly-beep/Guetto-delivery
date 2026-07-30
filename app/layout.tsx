import type { Metadata } from "next";
import type { Viewport } from "next";
import PwaRegistro from "@/components/PwaRegistro";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guetto Delivery",
  description: "Delivery de bebidas",
  applicationName: "Guetto Delivery",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Guetto",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#facc15",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <PwaRegistro />
      </body>
    </html>
  );
}
