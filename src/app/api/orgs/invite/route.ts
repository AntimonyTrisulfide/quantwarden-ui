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
    const inviterEmail = session.user.email || "Not available";

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
        const invitationSubject = "Invitation to join organization on QuantWarden";
        
        let targetUrl = "";
        let emailHtml = "";
        let ctaLabel = "";

        const roleQuery = await prisma.$queryRawUnsafe<{ name: string }[]>(
          `SELECT name FROM "role" WHERE id = $1 LIMIT 1`,
          inv.roleId
        );
        const roleName = roleQuery[0]?.name || inv.roleId || "Member";

        if (isRegistered) {
          targetUrl = `${baseUrl}/app/invites/${inviteId}`;
          ctaLabel = "View on QuantWarden";
        } else {
          targetUrl = `${baseUrl}/signup?callbackUrl=${encodeURIComponent(`/app/invites/${inviteId}`)}`;
          ctaLabel = "Sign up on QuantWarden";
        }

        emailHtml = `
          <div style="margin:0;padding:0;background:#f6f1e6;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#3d200a;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #f0dcae;border-radius:16px;overflow:hidden;box-shadow:0 10px 24px rgba(139,0,0,0.08);">
                    <tr>
                      <td style="padding:20px 24px;background:linear-gradient(160deg,#fff7e6 0%,#fde68a 35%,#fbbf24 65%,#f59e0b 100%);border-bottom:1px solid #f0dcae;">
                        <p style="margin:0;font-size:12px;letter-spacing:0.02em;font-weight:800;text-transform:none;">
                          <span style="color:#3d200a;">Quant</span><span style="color:#8B0000;">Warden</span>
                        </p>
                        <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;font-weight:800;color:#8B0000;">Invitation to join organization</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px;">
                        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#5f3a19;">You have been invited to collaborate on QuantWarden.</p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #f0dcae;border-radius:12px;background:#fffaf0;">
                          <tr>
                            <td style="padding:14px 16px;">
                              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#8a5d33;text-transform:uppercase;letter-spacing:0.06em;">Invitation Details</p>
                              <p style="margin:0 0 6px;font-size:14px;color:#3d200a;"><strong>Organization:</strong> ${orgName}</p>
                              <p style="margin:0 0 6px;font-size:14px;color:#3d200a;"><strong>Invited Role:</strong> ${roleName}</p>
                              <p style="margin:0 0 6px;font-size:14px;color:#3d200a;"><strong>Invited By:</strong> ${inviterName}</p>
                              <p style="margin:0 0 6px;font-size:14px;color:#3d200a;"><strong>Inviter Email:</strong> ${inviterEmail}</p>
                              <p style="margin:0;font-size:14px;color:#3d200a;"><strong>Recipient:</strong> ${inv.email}</p>
                            </td>
                          </tr>
                        </table>
                        <div style="margin-top:22px;">
                          <a href="${targetUrl}" style="display:inline-block;padding:12px 18px;background:#8B0000;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">
                            ${ctaLabel}
                          </a>
                        </div>
                        <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#8a5d33;">
                          This invitation expires in 7 days. If you were not expecting this invitation, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>
        `;

        const fromEmail = process.env.RESEND_FROM_EMAIL || "QuantWarden <onboarding@nourl.in>";

        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: inv.email,
          subject: invitationSubject,
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
