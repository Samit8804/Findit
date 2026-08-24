import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Feedback";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { AuthGate } from "@/components/auth/AuthGate";
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
  title: {
    default: "FindIt — Buy. Sell. Discover.",
    template: "%s | FindIt Marketplace",
  },
  description:
    "FindIt is a modern classified marketplace — buy and sell properties, vehicles, mobiles, jobs, services and more in your local area.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AuthGate>{children}</AuthGate>
          {/* Spacer so fixed bottom nav never covers footer content on mobile */}
          <div className="h-16 md:hidden" aria-hidden />
          <MobileBottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}