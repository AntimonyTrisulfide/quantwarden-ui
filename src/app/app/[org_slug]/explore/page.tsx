import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AssetExplorerClient from "./_components/AssetExplorerClient";
import { getSafeServerSession } from "@/lib/auth-session";

export default async function AssetExplorePage({ 
  params,
  searchParams
}: { 
  params: Promise<{ org_slug: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await params;
  const resolvedQuery = await searchParams;
  
  const session = await getSafeServerSession();
  if (!session?.user) redirect("/login");

  const orgRows = await prisma.$queryRawUnsafe<{ id: string, name: string, slug: string }[]>(
     `SELECT id, name, slug FROM "organization" WHERE "slug" = $1 LIMIT 1`, resolvedParams.org_slug
  );
  if (orgRows.length === 0) redirect("/app");
  const org = orgRows[0];

  const memberRows = await prisma.$queryRawUnsafe<{ role: string }[]>(
    `SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
    org.id,
    session.user.id
  );
  if (memberRows.length === 0) redirect("/app");
  const isAdmin = memberRows[0].role === "owner" || memberRows[0].role === "admin";

  return (
    <div className="relative isolate min-h-screen">
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)]"
      />

      <div className="relative z-10 min-h-screen overflow-y-auto">
        <AssetExplorerClient 
          org={org} 
          isAdmin={isAdmin}
          initialFilter={resolvedQuery.filter as string || ""}
          initialCipher={resolvedQuery.cipher as string || ""}
          initialKeySize={resolvedQuery.keySize as string || ""}
          initialTls={resolvedQuery.tls as string || ""}
          initialPqcSupported={resolvedQuery.pqcSupported as string || ""}
          initialPqcNegotiated={resolvedQuery.pqcNegotiated as string || ""}
        />
      </div>
    </div>
  );
}
