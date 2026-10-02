import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { notifications } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET /api/notifications — Notifications de l'utilisateur connecté
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const unreadCount = rows.filter((n) => !n.isRead).length;

  return NextResponse.json({ notifications: rows, unreadCount });
}

// PATCH /api/notifications — Marquer comme lu
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { notificationId, markAllRead } = body;

  if (markAllRead) {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return NextResponse.json({ success: true });
  }

  if (notificationId) {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "notificationId ou markAllRead requis" }, { status: 400 });
}
