import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Friend CRM",
  description: "Organize your relationships. Prioritize who matters most.",
  metadataBase: new URL("https://friend-crm-ten.vercel.app"),
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Friend CRM",
    description: "Organize your relationships. Prioritize who matters most.",
    url: "https://friend-crm-ten.vercel.app",
    siteName: "Friend CRM",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Friend CRM - Organize your relationships",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Friend CRM",
    description: "Organize your relationships. Prioritize who matters most.",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
