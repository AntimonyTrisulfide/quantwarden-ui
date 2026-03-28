import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, invites } = await req.json();

    if (!organizationId || !invites || !Array.isArray(invites)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Check permissions
    const memberRows = await prisma.$queryRawUnsafe<{ role: string }[]>(
      `SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      organizationId,
      session.user.id
    );

    if (memberRows.length === 0 || (memberRows[0].role !== "owner" && memberRows[0].role !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Only owners and admins can invite." }, { status: 403 });
    }

    // Get Organization Details
    const orgQuery = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM "organization" WHERE id = $1 LIMIT 1`,
      organizationId
    );
    if (!orgQuery.length) return NextResponse.json({ error: "Org not found" }, { status: 404 });
    const orgName = orgQuery[0].name;
    const inviterName = session.user.name || "A team member";

    // Process invites sequentially (or via Promise.all)
    for (const inv of invites) {
      if (!inv.email) continue;
      
      const inviteId = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiration

      // Deduplicate pending invites (prevent spam)
      const existingQuery = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "invitation" WHERE "organizationId" = $1 AND email = $2 AND status = 'pending'`,
        organizationId,
        inv.email
      );

      if (existingQuery.length > 0) continue; // Already has pending invite

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "invitation" (id, "organizationId", email, role, "expiresAt", "createdAt", "inviterId", status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
          inviteId,
          organizationId,
          inv.email,
          inv.roleId, // Expecting roleId to be the name or ID from array
          expiresAt,
          new Date(),
          session.user.id
        );

        // Check if user is registered
        const userQuery = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "user" WHERE email = $1 LIMIT 1`,
          inv.email
        );
        const isRegistered = userQuery.length > 0;

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        
        let targetUrl = "";
        let emailSubject = "";
        let emailHtml = "";

        if (isRegistered) {
          targetUrl = `${baseUrl}/app/invites/${inviteId}`;
          emailSubject = `You have been invited to join ${orgName}`;
          emailHtml = `
            <h2>Invitation to join ${orgName}</h2>
            <p>${inviterName} has invited you to join their organization on QuantWarden.</p>
            <p><a href="${targetUrl}" style="padding: 10px 16px; background-color: #8B0000; color: white; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Accept Invitation</a></p>
            <br />
            <p>If you have any questions, please contact support.</p>
          `;
        } else {
          targetUrl = `${baseUrl}/login?callbackUrl=/app/invites/${inviteId}`;
          emailSubject = `Invitation to join ${orgName} on QuantWarden`;
          emailHtml = `
            <h2>Invitation to join ${orgName}</h2>
            <p>${inviterName} has invited you to collaborate with them on QuantWarden.</p>
            <p>You need to create an account to accept this invitation.</p>
            <p><a href="${targetUrl}" style="padding: 10px 16px; background-color: #8B0000; color: white; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Create Account & Accept</a></p>
            <br />
            <p>If you don't want to join, simply ignore this email.</p>
          `;
        }

        const fromEmail = process.env.RESEND_FROM_EMAIL || "QuantWarden <onboarding@nourl.in>";

        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: inv.email,
          subject: emailSubject,
          html: emailHtml,
        });

        if (error) {
          console.error(`[Resend Error] Failed to send to ${inv.email}:`, error);
          // Also optionally delete the pending invite row so they can try again once they fix their domains
          await prisma.$executeRawUnsafe(`DELETE FROM "invitation" WHERE id = $1`, inviteId);
          return NextResponse.json({ error: `Resend configuration issue for ${inv.email}: ${error.message}` }, { status: 400 });
        }

        console.log(`[Resend Success] Sent to ${inv.email}:`, data);

      } catch (err: any) {
        console.error(`Failed processing invite for ${inv.email}`, err);
        return NextResponse.json({ error: `System processing error mapping invite for ${inv.email}: ${err?.message || ''}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Invite processing error:", error);
    return NextResponse.json(
      { error: "Something went wrong sending invites." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    // Check member access
    const memberRows = await prisma.$queryRawUnsafe<{ role: string }[]>(
      `SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      orgId,
      session.user.id
    );

    if (memberRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invites = await prisma.$queryRawUnsafe<{ id: string, email: string, role: string, status: string, "createdAt": Date }[]>(
      `SELECT id, email, role as "roleId", status, "createdAt" FROM "invitation" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC`,
      orgId
    );

    return NextResponse.json(invites);
  } catch (error) {
    console.error("GET Invites error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
