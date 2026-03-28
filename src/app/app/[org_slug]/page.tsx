import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import OnboardingFlow from "./_components/OnboardingFlow";
import DashboardView from "./_components/DashboardView";

export default async function OrganizationPage(props: { params: Promise<{ org_slug: string }> }) {
  const { org_slug } = await props.params;

  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    redirect("/login");
  }

  // Get the org and verify membership
  const orgRows = await prisma.$queryRawUnsafe<{
    id: string;
    name: string;
    slug: string;
    metadata: string | null;
    isPublic: boolean;
    discoverable: boolean;
    logo: string | null;
    memberRole: string;
  }[]>(
    `SELECT o.id, o.name, o.slug, o.metadata, o."isPublic", o.discoverable, o.logo, m.role as "memberRole" 
     FROM "organization" o
     INNER JOIN "member" m ON m."organizationId" = o.id AND m."userId" = $1
     WHERE o.slug = $2 LIMIT 1`,
    session.user.id,
    org_slug.toLowerCase()
  );

  if (orgRows.length === 0) {
    // If not a member, or doesn't exist
    redirect("/app");
  }

  const org = { ...orgRows[0], domains: [] as string[], roles: [] as any[] };
  
  // Fetch domains
  const domainsRows = await prisma.$queryRawUnsafe<{ domain: string }[]>(
    `SELECT domain FROM "domain" WHERE "organizationId" = $1`,
    org.id
  );
  org.domains = domainsRows.map(d => d.domain);

  // Fetch roles
  const rolesRows = await prisma.$queryRawUnsafe<{ id: string, name: string, permissions: string }[]>(
    `SELECT id, name, permissions FROM "role" WHERE "organizationId" = $1`,
    org.id
  );
  
  org.roles = rolesRows.map(r => {
    let perms = { team: false, scan: false, asset: false };
    try {
      if (r.permissions) perms = { ...perms, ...JSON.parse(r.permissions) };
    } catch(e) {}
    return { id: r.id, name: r.name, permissions: perms };
  });

  let setupComplete = false;
  if (org.metadata) {
    try {
      const meta = JSON.parse(org.metadata);
      setupComplete = !!meta.setupComplete;
    } catch (e) {
      // Ignore parsing errors
    }
  }

  if (!setupComplete && (orgRows[0].memberRole === "owner" || orgRows[0].memberRole === "admin")) {
    // Render onboarding flow
    return <OnboardingFlow org={org} />;
  }

  // Render actual dashboard layout
  return <DashboardView org={org} />;
}
