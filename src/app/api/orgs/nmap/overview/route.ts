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
    const daysStr = searchParams.get("days") || "30";
    const days = isNaN(parseInt(daysStr, 10)) ? 30 : parseInt(daysStr, 10);

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: session.user.id }
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Total targets
    const totalTargets = await prisma.nmapAsset.count({
      where: { organizationId: orgId }
    });

    // Fetch Latest Scans
    const scanRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT s."assetId", s."resultData", s."completedAt", a.target as "assetName" 
       FROM "nmap_asset_scan" s
       JOIN "nmap_asset" a ON a.id = s."assetId"
       WHERE a."organizationId" = $1 
         AND s.status = 'completed'
         AND s."completedAt" >= NOW() - INTERVAL '${days} days'
       ORDER BY s."completedAt" DESC`,
       orgId
    );

    const latestScansMap = new Map();
    for (const row of scanRows) {
      if (!latestScansMap.has(row.assetId)) {
         try {
           const parsed = typeof row.resultData === 'string' ? JSON.parse(row.resultData) : row.resultData;
           latestScansMap.set(row.assetId, { ...row, parsed: parsed.data });
         } catch(e) {}
      }
    }
    const latestScans = Array.from(latestScansMap.values());

    let totalScanned = latestScans.length;

    let totalOpenPorts = 0;
    let portsMap: Record<number, number> = {};
    let tlsVersionsMap: Record<string, number> = {};
    let pqcRiskMap: Record<string, number> = { "low": 0, "medium": 0, "high": 0, "unknown": 0 };
    
    let issuesDetected = 0;

    for (const scan of latestScans) {
       const p = scan.parsed;
       if (!p) continue;

       // Ports
       if (Array.isArray(p.open_ports)) {
           p.open_ports.forEach((portObj: any) => {
               const port = portObj.port;
               portsMap[port] = (portsMap[port] || 0) + 1;
               totalOpenPorts++;
           });
       }

       // TLS Versions
       if (Array.isArray(p.supported_tls_versions)) {
           p.supported_tls_versions.forEach((ver: string) => {
               tlsVersionsMap[ver] = (tlsVersionsMap[ver] || 0) + 1;
           });
       }

       // PQC Safety
       if (p.pqc_safety_intelligence) {
           const risk = p.pqc_safety_intelligence.quantum_break_risk || "unknown";
           pqcRiskMap[risk] = (pqcRiskMap[risk] || 0) + 1;
       } else {
           pqcRiskMap["unknown"]++;
       }

       // Issues
       if (Array.isArray(p.certificate_chain_issues)) {
          const hasIssue = p.certificate_chain_issues.some((i: any) => i.detected === true);
          if (hasIssue) issuesDetected++;
       }
    }

    const portExposureData = Object.entries(portsMap).map(([port, count]) => ({ port: port.toString(), count })).sort((a, b) => b.count - a.count).slice(0, 10);
    const tlsVersionsData = Object.entries(tlsVersionsMap).map(([version, count]) => ({ version, count })).sort((a, b) => b.count - a.count);
    const pqcRiskData = Object.entries(pqcRiskMap).filter(([_, count]) => count > 0).map(([risk, count]) => ({ risk, count }));

    return NextResponse.json({
       totalTargets,
       totalScanned,
       totalOpenPorts,
       issuesDetected,
       portExposureData,
       tlsVersionsData,
       pqcRiskData
    });
  } catch (error) {
    console.error("Nmap Overview fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
