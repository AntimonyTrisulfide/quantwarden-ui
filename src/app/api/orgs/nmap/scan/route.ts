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
    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: session.user.id }
    });

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Only owners and admins can trigger scans." }, { status: 403 });
    }

    // Ensure asset exists
    const asset = await prisma.nmapAsset.findFirst({
      where: { id: assetId, organizationId: orgId }
    });
    
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Set Asset scanStatus to scanning
    await prisma.nmapAsset.update({
      where: { id: assetId },
      data: { scanStatus: "scanning" }
    });

    // Provision Scan
    const scan = await prisma.nmapAssetScan.create({
      data: {
        assetId: assetId,
        status: "pending"
      }
    });

    try {
      const nmapUrl = process.env.NMAP_API_URL || "http://127.0.0.1:8010";
      
      const response = await fetch(`${nmapUrl}/ethical-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Increased timeout since Nmap takes longer (60 seconds allowed)
        body: JSON.stringify({ target: asset.target, timeout_seconds: 120 }),
      });

      const rawResult = await response.text();
      let parsed: any = {};
      try { parsed = JSON.parse(rawResult); } catch(e){}

      if (!response.ok || parsed.error || parsed.detail) {
        await prisma.nmapAssetScan.update({
          where: { id: scan.id },
          data: { status: "failed", resultData: rawResult, completedAt: new Date() }
        });
        await prisma.nmapAsset.update({
          where: { id: assetId },
          data: { scanStatus: "failed", lastScanDate: new Date() }
        });
        return NextResponse.json({ success: true, scanId: scan.id, status: "failed", data: parsed });
      }

      // Extract resolved_ip if available
      const payloadData = parsed.data || parsed;
      const resolvedIp = payloadData.resolved_ip || null;

      // Commit success
      await prisma.nmapAssetScan.update({
        where: { id: scan.id },
        data: { status: "completed", resultData: rawResult, completedAt: new Date() }
      });

      await prisma.nmapAsset.update({
        where: { id: assetId },
        data: { 
          scanStatus: "completed", 
          lastScanDate: new Date(),
          resolvedIp: resolvedIp
        }
      });

      return NextResponse.json({ success: true, scanId: scan.id, status: "completed", data: parsed });

    } catch (err: any) {
      // Commit failure
      await prisma.nmapAssetScan.update({
        where: { id: scan.id },
        data: { status: "failed", resultData: JSON.stringify({ error: err.message }), completedAt: new Date() }
      });
      await prisma.nmapAsset.update({
        where: { id: assetId },
        data: { scanStatus: "failed", lastScanDate: new Date() }
      });
      return NextResponse.json({ error: err.message || "Failed execution" }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Nmap Scan POST Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
