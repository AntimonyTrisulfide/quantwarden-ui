import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NmapAssetIntelligenceClient from "./_components/NmapAssetIntelligenceClient";
import { getSafeServerSession } from "@/lib/auth-session";

export default async function NmapAssetIntelligencePage({
  params,
}: {
  params: Promise<{ org_slug: string; asset_id: string }>;
}) {
  const resolvedParams = await params;

  const session = await getSafeServerSession();
  if (!session?.user) redirect("/login");

  const orgRows = await prisma.$queryRawUnsafe<
    { id: string; name: string; slug: string; logo: string | null }[]
  >(
    `SELECT id, name, slug, logo FROM "organization" WHERE "slug" = $1 LIMIT 1`,
    resolvedParams.org_slug
  );

  if (orgRows.length === 0) redirect("/app");
  const org = orgRows[0];

  const memberRows = await prisma.$queryRawUnsafe<{ role: string }[]>(
    `SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
    org.id,
    session.user.id
  );

  if (memberRows.length === 0) redirect("/app");
  const role = memberRows[0].role;
  const isAdmin = role === "owner" || role === "admin";

  const assetRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "nmap_asset" WHERE "id" = $1 AND "organizationId" = $2 LIMIT 1`,
    resolvedParams.asset_id,
    org.id
  );

  if (assetRows.length === 0) redirect(`/app/${org.slug}`);
  const asset = assetRows[0];

  const scanRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "nmap_asset_scan" WHERE "assetId" = $1 ORDER BY "createdAt" DESC`,
    asset.id
  );

  const latestScan = scanRows.length > 0 ? scanRows[0] : null;

  return (
    <div className="relative isolate min-h-screen">
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)]"
      />

      <div className="relative z-10 min-h-screen overflow-y-auto">
        <NmapAssetIntelligenceClient
          org={org}
          asset={asset}
          latestScan={latestScan}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
