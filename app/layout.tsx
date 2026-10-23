import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSession } from "@/lib/session";
import Nav from "./nav";

export const metadata: Metadata = {
  title: "Ofi Studio",
  description: "Devis et registre des réalisations du studio vidéo Keiko, Ofi Invest AM.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        {session && <Nav name={session.name} />}
        {children}
      </body>
    </html>
  );
}
