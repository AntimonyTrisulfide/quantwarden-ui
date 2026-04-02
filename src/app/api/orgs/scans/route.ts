import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    // Verify member permissions
    const memberRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      orgId,
      session.user.id
    );

    if (memberRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all assets for the org, and efficiently bundle the latest SSL scan
    const assets = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 
         a.id, a.value, a.type, a."isRoot", a."parentId", a."scanStatus", a."lastScanDate",
         (
           SELECT row_to_json(s)
           FROM "asset_scan" s
           WHERE s."assetId" = a.id
             AND s.type = 'openssl'
             AND s.status IN ('completed', 'failed')
           ORDER BY
             COALESCE(s."completedAt", s."createdAt") DESC,
             s."createdAt" DESC
           LIMIT 1
         ) as "latestScan",
         (
           SELECT row_to_json(s)
           FROM "asset_scan" s
           WHERE s."assetId" = a.id
             AND s.type = 'openssl'
             AND s.status = 'completed'
           ORDER BY
             COALESCE(s."completedAt", s."createdAt") DESC,
             s."createdAt" DESC
           LIMIT 1
         ) as "latestSuccessfulScan"
       FROM "asset" a
       WHERE a."organizationId" = $1
       ORDER BY a.value ASC`,
      orgId
    );

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("Scans fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
