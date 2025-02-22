import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@trivo/ui/toaster";
import { TooltipProvider } from "@trivo/ui/tooltip";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trivo",
  description: "Trivo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
