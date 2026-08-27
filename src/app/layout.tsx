import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Feedback";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { AuthGate } from "@/components/auth/AuthGate";
import { UnreadProvider } from "@/components/providers/UnreadProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL, organizationJsonLd, webSiteJsonLd } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FindIt – Buy & Sell Classified Ads Near You",
    template: "%s | FindIt",
  },
  description:
    "Discover local classifieds on FindIt — buy and sell vehicles, property, mobiles, jobs, services and trusted businesses near you. Post free ads and connect with verified sellers across India.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    siteName: "FindIt",
    type: "website",
    url: SITE_URL,
    title: "FindIt – Buy & Sell Classified Ads Near You",
    description:
      "Discover local classifieds on FindIt — buy and sell vehicles, property, mobiles, jobs, services and trusted businesses near you.",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "FindIt – Buy & Sell Classified Ads Near You",
    description:
      "Discover local classifieds on FindIt — buy and sell vehicles, property, mobiles, jobs, services and trusted businesses near you.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" />
      </head>
      <body className="min-h-full flex flex-col">
        <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
        <ToastProvider>
          <UnreadProvider>
            <AuthGate>{children}</AuthGate>
            <div className="h-16 md:hidden" aria-hidden />
            <MobileBottomNav />
          </UnreadProvider>
        </ToastProvider>
      </body>
    </html>
  );
}