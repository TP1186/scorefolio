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
    title: "AuditSentry — Premium Audit Intelligence",
    description:
      "An interactive proof of concept for AI-assisted workers’ compensation premium-audit preparation.",
    openGraph: {
      title: "AuditSentry — Premium Audit Intelligence",
      description: "Know the exposure before the auditor does.",
      images: [{ url: socialImage, width: 1792, height: 922 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "AuditSentry — Premium Audit Intelligence",
      description: "Know the exposure before the auditor does.",
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
