import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, discoverable, isPublic, domains, setupComplete, roles } = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    // Verify permissions
    const memberRows = await prisma.$queryRawUnsafe<{ role: string }[]>(
      `SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      organizationId,
      session.user.id
    );

    if (memberRows.length === 0 || (memberRows[0].role !== "owner" && memberRows[0].role !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Only owners and admins can complete setup." }, { status: 403 });
    }

    // Partial update properties
    const setQueryParts = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (discoverable !== undefined) {
      setQueryParts.push(`discoverable = $${paramIndex++}`);
      values.push(!!discoverable);
    }
    if (isPublic !== undefined) {
      setQueryParts.push(`"isPublic" = $${paramIndex++}`);
      values.push(!!isPublic);
    }
    if (setupComplete !== undefined) {
      setQueryParts.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify({ setupComplete: !!setupComplete }));
    }

    if (setQueryParts.length > 0) {
      values.push(organizationId); // Add organizationId at the very end
      const query = `UPDATE "organization" SET ${setQueryParts.join(", ")} WHERE id = $${paramIndex}`;
      await prisma.$executeRawUnsafe(query, ...values);
    }

    // Update Domains if provided
    if (domains && Array.isArray(domains)) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "domain" WHERE "organizationId" = $1`,
        organizationId
      );

      for (const d of domains) {
        try {
          const domainId = crypto.randomUUID();
          await prisma.$executeRawUnsafe(
            `INSERT INTO "domain" (id, domain, "organizationId", verified, "createdAt") VALUES ($1, $2, $3, $4, $5)`,
            domainId,
            d,
            organizationId,
            false,
            new Date()
          );
        } catch (e) {
          console.warn("Domain insert failed for:", d, e);
        }
      }
    }

    // Update Roles if provided
    if (roles && Array.isArray(roles)) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "role" WHERE "organizationId" = $1`,
        organizationId
      );

      for (const r of roles) {
        try {
          const roleId = crypto.randomUUID();
          await prisma.$executeRawUnsafe(
            `INSERT INTO "role" (id, name, permissions, "organizationId", "createdAt") VALUES ($1, $2, $3, $4, $5)`,
            roleId,
            r.name,
            JSON.stringify(r.permissions || {}),
            organizationId,
            new Date()
          );
        } catch (e) {
          console.warn("Role insert failed for:", r.name, e);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Org setup error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
