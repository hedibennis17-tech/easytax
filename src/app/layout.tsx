import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyTax Canada — Déclaration d'impôt simplifiée",
  description: "Préparez et transmettez votre déclaration fédérale et Québec en quelques minutes. Déposez vos documents, EasyTax fait le reste.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
