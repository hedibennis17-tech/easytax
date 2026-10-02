/**
 * OrgService — Sécurité multi-tenant organizations
 *
 * RÈGLE ABSOLUE :
 * - Toutes les vérifications d'accès sont côté SERVEUR uniquement
 * - Org A ne peut JAMAIS voir les données de Org B
 * - Un membership doit être ACTIVE pour donner accès
 * - Un preparer doit avoir un assignment ACTIVE pour voir un client
 */

import { db } from "@/lib/db";
import {
  organizations,
  organizationMemberships,
  preparerProfiles,
  preparerClientAssignments,
  notifications,
  invitations,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

// ─── MEMBERSHIP ───────────────────────────────────────────────────────────────

/**
 * Vérifier qu'un user est membre actif d'une organisation
 * Usage: avant tout accès à une ressource de l'org
 */
export async function assertOrgMember(
  userId: string,
  orgId: string
): Promise<{ role: string; permissions: string[] } | null> {
  const rows = await db
    .select({
      role: organizationMemberships.role,
      permissions: organizationMemberships.permissions,
      status: organizationMemberships.status,
    })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, orgId),
        eq(organizationMemberships.status, "active")
      )
    )
    .limit(1);

  if (!rows[0]) return null;

  const perms = rows[0].permissions
    ? (JSON.parse(rows[0].permissions) as string[])
    : [];

  return { role: rows[0].role, permissions: perms };
}

/**
 * Vérifier qu'un user est OWNER ou ADMIN d'une organisation
 */
export async function assertOrgAdmin(
  userId: string,
  orgId: string
): Promise<boolean> {
  const membership = await assertOrgMember(userId, orgId);
  if (!membership) return false;
  return membership.role === "OWNER" || membership.role === "ADMIN";
}

/**
 * Récupérer toutes les organisations d'un user (membership actif)
 */
export async function getUserOrganizations(userId: string) {
  const rows = await db
    .select({
      org: organizations,
      role: organizationMemberships.role,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizationMemberships.organizationId, organizations.id)
    )
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.status, "active"),
        eq(organizations.status, "active")
      )
    );

  return rows;
}

// ─── PREPARER ─────────────────────────────────────────────────────────────────

/**
 * Vérifier qu'un préparateur a accès à un client
 * Accès = assignment actif + année dans la liste autorisée (si fournie)
 */
export async function assertPreparerAccess(
  preparerUserId: string,
  clientProfileId: string,
  taxYear?: number
): Promise<boolean> {
  const preparer = await db
    .select({ id: preparerProfiles.id })
    .from(preparerProfiles)
    .where(
      and(
        eq(preparerProfiles.userId, preparerUserId),
        eq(preparerProfiles.isActive, true)
      )
    )
    .limit(1);

  if (!preparer[0]) return false;

  const assignment = await db
    .select({
      status: preparerClientAssignments.status,
      authorizedTaxYears: preparerClientAssignments.authorizedTaxYears,
    })
    .from(preparerClientAssignments)
    .where(
      and(
        eq(preparerClientAssignments.preparerId, preparer[0].id),
        eq(preparerClientAssignments.clientProfileId, clientProfileId),
        eq(preparerClientAssignments.status, "active")
      )
    )
    .limit(1);

  if (!assignment[0]) return false;

  // Vérifier l'année si spécifiée
  if (taxYear && assignment[0].authorizedTaxYears) {
    const years = JSON.parse(assignment[0].authorizedTaxYears) as number[];
    if (!years.includes(taxYear)) return false;
  }

  return true;
}

/**
 * Récupérer les clients d'un préparateur (assignments actifs)
 */
export async function getPreparerClients(preparerUserId: string) {
  const preparer = await db
    .select({ id: preparerProfiles.id })
    .from(preparerProfiles)
    .where(eq(preparerProfiles.userId, preparerUserId))
    .limit(1);

  if (!preparer[0]) return [];

  return db
    .select()
    .from(preparerClientAssignments)
    .where(
      and(
        eq(preparerClientAssignments.preparerId, preparer[0].id),
        eq(preparerClientAssignments.status, "active")
      )
    );
}

// ─── INVITATIONS ──────────────────────────────────────────────────────────────

/**
 * Créer une invitation sécurisée avec token aléatoire
 */
export async function createInvitation(params: {
  type: "ORG_MEMBER" | "PREPARER_CLIENT" | "EMPLOYEE";
  organizationId?: string;
  preparerId?: string;
  invitedEmail: string;
  role?: "OWNER" | "ADMIN" | "MEMBER" | "EMPLOYEE" | "ACCOUNTANT" | "REVIEWER";
  createdByUserId: string;
  expiresInDays?: number;
}) {
  // Token cryptographiquement sécurisé — 48 bytes = 64 chars hex
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays ?? 7));

  const [inv] = await db
    .insert(invitations)
    .values({
      type: params.type,
      organizationId: params.organizationId ?? null,
      preparerId: params.preparerId ?? null,
      invitedEmail: params.invitedEmail,
      role: params.role ?? null,
      token,
      status: "pending",
      expiresAt,
      createdByUserId: params.createdByUserId,
    })
    .returning();

  return inv;
}

/**
 * Valider et consommer un token d'invitation
 */
export async function acceptInvitation(token: string, acceptingUserId: string) {
  const [inv] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.token, token),
        eq(invitations.status, "pending")
      )
    )
    .limit(1);

  if (!inv) return { success: false, reason: "invitation_not_found" };

  if (new Date() > inv.expiresAt) {
    await db
      .update(invitations)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(invitations.id, inv.id));
    return { success: false, reason: "invitation_expired" };
  }

  // Marquer comme acceptée
  await db
    .update(invitations)
    .set({
      status: "accepted",
      invitedUserId: acceptingUserId,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invitations.id, inv.id));

  // Créer le membership si c'est une invitation org
  if (inv.type === "ORG_MEMBER" && inv.organizationId && inv.role) {
    await db
      .insert(organizationMemberships)
      .values({
        organizationId: inv.organizationId,
        userId: acceptingUserId,
        role: inv.role,
        status: "active",
        invitedByUserId: inv.createdByUserId,
        invitedAt: inv.createdAt,
        acceptedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  return { success: true, invitation: inv };
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export async function createNotification(params: {
  userId: string;
  type: string;
  titleFr: string;
  titleEn?: string;
  bodyFr?: string;
  bodyEn?: string;
  relatedResourceType?: string;
  relatedResourceId?: string;
}) {
  const [notif] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      type: params.type,
      titleFr: params.titleFr,
      titleEn: params.titleEn ?? null,
      bodyFr: params.bodyFr ?? null,
      bodyEn: params.bodyEn ?? null,
      relatedResourceType: params.relatedResourceType ?? null,
      relatedResourceId: params.relatedResourceId
        ? (params.relatedResourceId as string)
        : null,
    })
    .returning();

  return notif;
}
