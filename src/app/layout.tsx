import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyTax Canada — Déclaration fiscale simplifiée",
  description: "Déclarez vos impôts fédéraux et québécois simplement. Téléversez vos documents, répondez à quelques questions, et c'est tout.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={frFR}>
      <html lang="fr">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
