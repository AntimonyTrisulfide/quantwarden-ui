import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetId, orgId } = await req.json();

    if (!assetId || !orgId) {
      return NextResponse.json({ error: "Missing config fields" }, { status: 400 });
    }

    // Verify permissions
    const memberRows = await prisma.$queryRawUnsafe<{ role: string }[]>(
      `SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      orgId,
      session.user.id
    );

    if (memberRows.length === 0 || (memberRows[0].role !== "owner" && memberRows[0].role !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Only owners and admins can trigger scans." }, { status: 403 });
    }

    // Ensure asset exists
    const assetRows = await prisma.$queryRawUnsafe<{ value: string, type: string }[]>(
      `SELECT value, type FROM "asset" WHERE id = $1 AND "organizationId" = $2 LIMIT 1`,
      assetId,
      orgId
    );
    
    if (!assetRows.length) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const asset = assetRows[0];
    
    // We only SSL-scan domains (or IPv4s that route, but typically domains)
    if (asset.type !== 'domain') {
       return NextResponse.json({ error: "PySSL only scans domains" }, { status: 400 });
    }

    // 1. Provision AssetScan
    const scanId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "asset_scan" (id, "assetId", type, status, "createdAt") VALUES ($1, $2, 'pyssl', 'pending', $3)`,
      scanId,
      assetId,
      new Date()
    );

    try {
      const pysslUrl = process.env.PYSSL_API_URL || "http://127.0.0.1:8000";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout for SSL scan
      
      const response = await fetch(`${pysslUrl}/api/v1/ssl-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: asset.value }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const rawResult = await response.text();
      let parsed = {};
      try { parsed = JSON.parse(rawResult); } catch(e){}

      if (!response.ok) {
        // Save exactly what PySSL told us (e.g., DNS resolution failed)
        await prisma.$executeRawUnsafe(
          `UPDATE "asset_scan" SET status = 'failed', "resultData" = $1, "completedAt" = $2 WHERE id = $3`,
          rawResult,
          new Date(),
          scanId
        );
        return NextResponse.json({ success: true, scanId, status: "failed", data: parsed });
      }

      // 2. Commit success
      await prisma.$executeRawUnsafe(
        `UPDATE "asset_scan" SET status = 'completed', "resultData" = $1, "completedAt" = $2 WHERE id = $3`,
        rawResult, // Store pure string exactly as we got it
        new Date(),
        scanId
      );

      return NextResponse.json({ success: true, scanId, status: "completed", data: parsed });

    } catch (err: any) {
      // 3. Commit failure
      await prisma.$executeRawUnsafe(
        `UPDATE "asset_scan" SET status = 'failed', "resultData" = $1, "completedAt" = $2 WHERE id = $3`,
        JSON.stringify({ error: err.message }),
        new Date(),
        scanId
      );
      return NextResponse.json({ error: err.message || "Failed execution" }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
