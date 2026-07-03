import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConditionalApp from "./components/ConditionalApp";
import { AuthProvider } from "@/contexts/AuthContext";

export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Teach Connect - LMS",
  description: "Premium Learning Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css" />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ConditionalApp>{children}</ConditionalApp>
        </AuthProvider>
        <script src="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/scripts/verify.min.js" async></script>
      </body>
    </html>
  );
}
