import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { StarField } from "@/components/shell/star-field";
import { ServiceWorkerBridge } from "@/components/shell/service-worker-bridge";
import { StoreHydrator } from "@/components/shell/store-hydrator";
import { ThemeScript } from "@/components/shell/theme-script";
import { ThemeProvider } from "@/components/shell/theme-provider";

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
  // Two entries so the browser chrome matches before our script runs; the
  // script then keeps it in step with an explicit Day/Night choice.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F5FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B1F" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `suppressHydrationWarning`: the boot script stamps data-theme and
  // color-scheme onto <html> before React hydrates, so the server markup and
  // the live DOM differ there by design.
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">
        <a
          href="#main-content"
          className="fixed top-2 left-2 z-[100] inline-flex min-h-11 -translate-y-20 items-center rounded-xl bg-violet px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0"
        >
          Skip to main content
        </a>
        <ThemeScript />
        <StarField />
        <StoreHydrator />
        <ThemeProvider />
        <ServiceWorkerBridge />
        <div id="main-content" tabIndex={-1} className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
