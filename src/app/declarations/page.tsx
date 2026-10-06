import { redirect } from "next/navigation";

// Alias durable : les liens historiques utilisent /declarations tandis que
// l’écran fiscal principal est servi par /declaration. La redirection évite
// toute duplication de calcul, de données ou de contrôle d’accès.
export const dynamic = "force-dynamic";

export default function DeclarationsAliasPage() {
  redirect("/declaration");
}
