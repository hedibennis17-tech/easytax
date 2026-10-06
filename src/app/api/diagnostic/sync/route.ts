import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/resume/sync-from-docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": "" },
  }).catch(e => ({ ok: false, json: async () => ({ error: String(e) }) } as unknown as Response));

  const data = await res.json() as { totalCreated?: number };
  return NextResponse.json({
    ok: true,
    message: `${data.totalCreated ?? 0} entrée(s) créée(s)`,
    details: data,
  });
}
