import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { StarField } from "@/components/shell/star-field";
import { ServiceWorkerBridge } from "@/components/shell/service-worker-bridge";
import { StoreHydrator } from "@/components/shell/store-hydrator";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const APP_NAME = "Lifequest";
const APP_DESCRIPTION =
  "Play your own game of life. Track health, wealth, connections, purpose, growth, inner peace and fun — and actually enjoy it.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: `${APP_NAME} — your own game of life`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    title: `${APP_NAME} — your own game of life`,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B1F",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Locks the layout to app-like behaviour: no pinch zoom, no rubber-band
  // resize when the on-screen keyboard opens.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-dvh antialiased">
        <StarField />
        <StoreHydrator />
        <ServiceWorkerBridge />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
