import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// PATCH /api/declaration/edit
// Enregistre une modification manuelle d'une ligne T1 ou TP-1
// Pour l'instant: log seulement (la déclaration est recalculée à chaque GET)
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json() as { form: string; line: string; amountCents: number };
  // TODO: persister en DB dans une table declaration_overrides
  console.log(`[declaration/edit] ${userId} — ${body.form} ligne ${body.line} = ${body.amountCents} cents`);
  return NextResponse.json({ ok: true });
}
