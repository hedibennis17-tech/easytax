import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taxYears } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const years = await db.select().from(taxYears).orderBy(taxYears.year);
  return NextResponse.json({ years });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const body = await req.json();
  const { year } = body;

  if (!year) return NextResponse.json({ error: "year requis" }, { status: 400 });

  // Vérifier si existe déjà
  const existing = await db.select().from(taxYears).where(eq(taxYears.year, year)).limit(1);
  if (existing[0]) return NextResponse.json(existing[0]);

  const [created] = await db.insert(taxYears).values({ year, status: "open" }).returning();
  return NextResponse.json(created, { status: 201 });
}
