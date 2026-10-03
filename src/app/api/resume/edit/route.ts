import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, incomeEntries, deductionEntries, creditEntries, extractionFields } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json() as {
    type: string; id: string;
    amountCents?: number; description?: string;
    employerName?: string; isValidated?: boolean;
    validatedValue?: string;
  };
  const { type, id } = body;

  const [profile] = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  if (type === "income") {
    await db.update(incomeEntries).set({
      ...(body.amountCents !== undefined && { amountCents: body.amountCents }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.employerName !== undefined && { employerName: body.employerName }),
      ...(body.isValidated !== undefined && { isValidated: body.isValidated }),
      updatedAt: new Date(),
    }).where(and(eq(incomeEntries.id, id), eq(incomeEntries.userId, clerkUserId)));
    return NextResponse.json({ ok: true });
  }
  if (type === "deduction") {
    await db.update(deductionEntries).set({
      ...(body.amountCents !== undefined && { amountCents: body.amountCents }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isValidated !== undefined && { isValidated: body.isValidated }),
      updatedAt: new Date(),
    }).where(and(eq(deductionEntries.id, id), eq(deductionEntries.userId, clerkUserId)));
    return NextResponse.json({ ok: true });
  }
  if (type === "credit") {
    await db.update(creditEntries).set({
      ...(body.amountCents !== undefined && { claimedAmountCents: body.amountCents }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isValidated !== undefined && { isValidated: body.isValidated }),
      updatedAt: new Date(),
    }).where(and(eq(creditEntries.id, id), eq(creditEntries.userId, clerkUserId)));
    return NextResponse.json({ ok: true });
  }
  if (type === "field") {
    await db.update(extractionFields).set({
      validatedValue: body.validatedValue,
      validationStatus: "corrected",
      correctedByUserId: clerkUserId,
      correctedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(extractionFields.id, id));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
}
