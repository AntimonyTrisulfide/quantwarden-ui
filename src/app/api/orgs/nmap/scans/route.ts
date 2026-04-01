// Force route recompile 2
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
    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: session.user.id }
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Auto-inherit normal domain assets into nmap assets
    const normalAssets = await prisma.asset.findMany({
      where: { organizationId: orgId, type: "domain" }
    });

    if (normalAssets.length > 0) {
      // Bulk insert missing assets (skip duplicates handles the ON CONFLICT DO NOTHING)
      await prisma.nmapAsset.createMany({
        data: normalAssets.map(asset => ({
          organizationId: orgId,
          target: asset.value
        })),
        skipDuplicates: true
      });
    }

    // Fetch all nmap assets for the org, and efficiently bundle the latest nmap scan
    const assets = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 
         a.id, a.target, a."resolvedIp", a."scanStatus", a."lastScanDate", a."createdAt",
         (SELECT row_to_json(s) FROM "nmap_asset_scan" s WHERE s."assetId" = a.id ORDER BY s."createdAt" DESC LIMIT 1) as "latestScan"
       FROM "nmap_asset" a
       WHERE a."organizationId" = $1
       ORDER BY a.target ASC`,
      orgId
    );

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("Nmap Scans fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
