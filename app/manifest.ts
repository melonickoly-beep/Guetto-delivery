import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Guetto Delivery",
    short_name: "Guetto",
    description: "Bebidas, conveniência e tabacaria.",
    start_url: "/",
    display: "standalone",
    background_color: "#18181b",
    theme_color: "#facc15",
    lang: "pt-BR",
    icons: [
      {
        src: "/images/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
