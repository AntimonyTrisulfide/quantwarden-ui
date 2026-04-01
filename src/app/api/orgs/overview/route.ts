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

    // Role check
    const memberRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      orgId,
      session.user.id
    );

    if (memberRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Fetch Discovery Assets 
    const assetTypesRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT type, "isRoot" FROM "asset" WHERE "organizationId" = $1`, orgId
    );
    let totalAssets = assetTypesRows.length;
    let domains = 0; let subdomains = 0; let ips = 0; let cloud = 0;
    for (const a of assetTypesRows) {
       if (a.type === 'domain') {
          if (a.isRoot) domains++; else subdomains++;
       } else if (a.type === 'ip') ips++;
    }

    // 2. Fetch Latest Scans (within the defined time window)
    const scanRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT s."assetId", s."resultData", s."completedAt", a.value as "assetName" 
       FROM "asset_scan" s
       JOIN "asset" a ON a.id = s."assetId"
       WHERE a."organizationId" = $1 
         AND s.type = 'pyssl' 
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
           latestScansMap.set(row.assetId, { ...row, parsed });
         } catch(e) {}
      }
    }
    const latestScans = Array.from(latestScansMap.values());

    // 3. Aggregate
    let totalScanned = latestScans.length;
    let expiredCerts = 0;
    let closeDeadlineCerts = 0;
    let validCerts = 0;
    
    let tlsVersions: Record<string, number> = {};
    let algorithms: Record<string, number> = {};
    let keySizes: Record<string, number> = {};
    let strongCipherCount = 0;
    let weakCipherCount = 0;
    let selfSignedCount = 0;
    let tlsDowngradeVulnerable = 0;

    let topRiskAssets: any[] = [];

    for (const scan of latestScans) {
       const p = scan.parsed;
       if (!p) continue;

       // Validity Processing
       const daysRem = p.certificate?.validity?.days_remaining;
       const isValid = p.security_analysis?.certificate_valid;
       
       let isRisk = false;
       let issue = "";
       let sortVal = 9999;

       if (isValid === false) {
         expiredCerts++;
         isRisk = true;
         issue = "Invalid Certificate";
         sortVal = -1;
       } else if (daysRem !== undefined) {
         if (daysRem <= 0) { 
           expiredCerts++; 
           isRisk = true; 
           issue = "Certificate Expired"; 
           sortVal = 0; 
         }
         else if (daysRem <= 30) { 
           closeDeadlineCerts++; 
           isRisk = true; 
           issue = `Expires in ${daysRem} days`; 
           sortVal = daysRem; 
         }
         else {
           validCerts++;
         }
       }
       
       if (isRisk) {
         topRiskAssets.push({
           id: scan.assetId,
           name: scan.assetName,
           issue,
           sortVal
         });
       }

       // TLS
       const tls = p.connection_info?.protocol?.version;
       if (tls) tlsVersions[tls] = (tlsVersions[tls] || 0) + 1;

       // Algorithms
       const cname = p.connection_info?.protocol?.cipher_suite?.name;
       if (cname) algorithms[cname] = (algorithms[cname] || 0) + 1;

       // Key sizes
       const ks = p.certificate?.public_key?.size;
       const kalg = p.certificate?.public_key?.algorithm || "Unknown";
       if (ks) {
          const keyName = `${kalg} ${ks}-bit`;
          keySizes[keyName] = (keySizes[keyName] || 0) + 1;
       }

       // Security analysis
       const sa = p.security_analysis;
       if (sa) {
         if (sa.strong_cipher) strongCipherCount++; else weakCipherCount++;
         if (sa.self_signed_cert) selfSignedCount++;
         if (sa.tls_version_secure === false) tlsDowngradeVulnerable++;
       }
    }

    const tlsChartData = Object.entries(tlsVersions).map(([name, value]) => ({ name, value }));
    const algoChartData = Object.entries(algorithms).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
    const keySizeChartData = Object.entries(keySizes).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);

    // Dynamic Tier Logic
    let tier = { grade: "A", tier: "Tier 1", label: "Excellent", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" };
    const failureRate = totalScanned > 0 ? (expiredCerts + weakCipherCount + selfSignedCount) / (totalScanned * 3) : 0;
    if (failureRate > 0) tier = { grade: "B", tier: "Tier 2", label: "Good", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" };
    if (failureRate > 0.1) tier = { grade: "C", tier: "Tier 3", label: "Satisfactory", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" };
    if (failureRate > 0.3) tier = { grade: "D", tier: "Tier 4", label: "Needs Improvement", color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" };

    topRiskAssets = topRiskAssets.sort((a,b) => a.sortVal - b.sortVal).slice(0, 3);

    return NextResponse.json({
       totalAssets,
       discovery: { domains, subdomains, ips, cloud },
       totalScanned,
       expiredCerts,
       closeDeadlineCerts,
       validCerts,
       tlsChartData,
       algoChartData,
       keySizeChartData,
       strongCipherCount,
       weakCipherCount,
       selfSignedCount,
       tlsDowngradeVulnerable,
       tier,
       topRiskAssets
    });
  } catch (error) {
    console.error("Overview fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
