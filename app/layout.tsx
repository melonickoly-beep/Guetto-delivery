import type { Metadata } from "next";
import type { Viewport } from "next";
import PwaRegistro from "@/components/PwaRegistro";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://guettodelivery.com.br"),
  title: "Guetto Delivery | Bebidas, conveniência e tabacaria",
  description:
    "Bebidas, gelo, conveniência e tabacaria em Paranacity, Vila Rural e Cruzeiro do Sul.",
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
  openGraph: {
    title: "Guetto Delivery",
    description:
      "Bebidas, conveniência e tabacaria em Paranacity, Vila Rural e Cruzeiro do Sul.",
    url: "/",
    siteName: "Guetto Delivery",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/og-guetto-delivery.png",
        width: 1731,
        height: 909,
        alt: "Guetto Delivery — bebidas, conveniência e tabacaria",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Guetto Delivery",
    description:
      "Bebidas, conveniência e tabacaria em Paranacity, Vila Rural e Cruzeiro do Sul.",
    images: ["/og-guetto-delivery.png"],
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
