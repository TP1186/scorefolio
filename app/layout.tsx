import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;

  return {
    title: "AuditSentry — Your Workers’ Comp Audit, Organized",
    description:
      "Securely organize workers’ compensation audit records, identify missing documents, and prepare one review-ready packet.",
    openGraph: {
      title: "AuditSentry — Your Workers’ Comp Audit, Organized",
      description: "Upload the records. Find the gaps. Send one clean packet.",
      images: [{ url: socialImage, width: 1740, height: 909 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "AuditSentry — Your Workers’ Comp Audit, Organized",
      description: "Upload the records. Find the gaps. Send one clean packet.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
