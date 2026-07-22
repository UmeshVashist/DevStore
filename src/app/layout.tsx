import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionTimeoutHandler } from "@/components/SessionTimeoutHandler";
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
  title: "DevData - Cloud File Storage",
  description: "Store, manage, and access all your files with Google Drive cloud storage",
  icons: {
    icon: "https://jxechgirxrbrblyrrqmt.supabase.co/storage/v1/object/public/images/bb5b5ced-6b47-425c-aad2-065017342a96/1783055155229-cloud-storage%20(1).png",
    shortcut: "https://jxechgirxrbrblyrrqmt.supabase.co/storage/v1/object/public/images/bb5b5ced-6b47-425c-aad2-065017342a96/1783055155229-cloud-storage%20(1).png",
    apple: "https://jxechgirxrbrblyrrqmt.supabase.co/storage/v1/object/public/images/bb5b5ced-6b47-425c-aad2-065017342a96/1783055155229-cloud-storage%20(1).png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isSatellite = process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE === "true";
  const domain = process.env.NEXT_PUBLIC_CLERK_DOMAIN;
  const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;

  return (
    <ClerkProvider
      isSatellite={isSatellite}
      domain={domain as string}
      signInUrl={signInUrl as string}
      satelliteAutoSync={true}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl={`${process.env.NEXT_PUBLIC_LAUNCHER_URL || "https://dev-tech-hub.vercel.app"}/auth/login`}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider>
            <SessionTimeoutHandler />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
