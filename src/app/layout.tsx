import type { Metadata } from "next";
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
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
