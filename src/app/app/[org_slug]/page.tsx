import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import OnboardingFlow from "./_components/OnboardingFlow";
import OrgDashboard from "./_components/OrgDashboard";
import PendingRequestView from "./_components/PendingRequestView";

export default async function OrganizationPage(props: { params: Promise<{ org_slug: string }> }) {
  const { org_slug } = await props.params;

  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    redirect("/login");
  }

  // Get the org
  const orgBasicRows = await prisma.$queryRawUnsafe<{
    id: string;
    name: string;
    slug: string;
    metadata: string | null;
    isPublic: boolean;
    discoverable: boolean;
    logo: string | null;
  }[]>(
    `SELECT id, name, slug, metadata, "isPublic", discoverable, logo 
     FROM "organization" WHERE slug = $1 LIMIT 1`,
    org_slug.toLowerCase()
  );

  if (orgBasicRows.length === 0) {
    redirect("/app");
  }

  const orgBasic = orgBasicRows[0];

  // Check membership
  const memberRows = await prisma.$queryRawUnsafe<{
    id: string;
    role: string;
  }[]>(
    `SELECT id, role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
    orgBasic.id,
    session.user.id
  );

  // If not a member, check for pending join requests
  if (memberRows.length === 0) {
    const requestRows = await prisma.$queryRawUnsafe<{
      id: string;
      status: string;
      createdAt: Date;
    }[]>(
      `SELECT id, status, "createdAt" FROM "join_request" 
       WHERE "organizationId" = $1 AND "userId" = $2 
       ORDER BY "createdAt" DESC LIMIT 1`,
      orgBasic.id,
      session.user.id
    );

    if (requestRows.length > 0) {
      return (
        <PendingRequestView
          org={{ id: orgBasic.id, name: orgBasic.name, slug: orgBasic.slug, logo: orgBasic.logo }}
          request={{ id: requestRows[0].id, status: requestRows[0].status, createdAt: requestRows[0].createdAt }}
        />
      );
    }

    // Not a member, no request — redirect
    redirect("/app");
  }

  const memberRole = memberRows[0].role;

  // Build org data with domains and roles
  const org = { ...orgBasic, domains: [] as string[], roles: [] as any[] };

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

  if (!setupComplete && (memberRole === "owner" || memberRole === "admin")) {
    // Render onboarding flow
    return <OnboardingFlow org={org} />;
  }

  // Render actual dashboard
  return (
    <OrgDashboard
      org={org}
      currentUserRole={memberRole}
      currentUserId={session.user.id}
    />
  );
}
