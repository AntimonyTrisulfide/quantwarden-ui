import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { inferAssetBucket } from "@/lib/asset-buckets";
import { getOrgMemberAccess } from "@/lib/org-scan-permissions";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

function getAssetType(value: string): "domain" | "ip" | "unknown" {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}$/;
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

  if (ipv4Regex.test(value) || ipv6Regex.test(value)) return "ip";
  if (domainRegex.test(value)) return "domain";
  return "unknown";
}

export const maxDuration = 300; // Allow routing engines to keep alive up to 5 mins

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");
  const orgId = searchParams.get("orgId");

  if (!assetId || !orgId) {
    return new NextResponse("Missing assetId or orgId", { status: 400 });
  }

  const access = await getOrgMemberAccess(orgId, session.user.id);
  if (!access?.canManageAssets) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Fetch the asset value
  const assetRows = await prisma.$queryRawUnsafe<{ value: string }[]>(
    `SELECT value FROM "asset" WHERE id = $1 AND "organizationId" = $2 LIMIT 1`,
    assetId,
    orgId
  );

  if (assetRows.length === 0) {
    return new NextResponse("Asset not found", { status: 404 });
  }

  const domain = assetRows[0].value;

  // Use Web Streams API for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream might be closed by client
        }
      };

      let keepAliveInterval: any;

      try {
        sendEvent("status", { message: "Starting subdomain discovery..." });

        // Keep-alive mechanism to prevent browser timeout
        keepAliveInterval = setInterval(() => {
          sendEvent("ping", { message: "Scanning... Please wait.", timestamp: Date.now() });
        }, 8000); // ping every 8s

        // Mark DB as scanning
        await prisma.$executeRawUnsafe(
          `UPDATE "asset" SET "scanStatus" = 'scanning' WHERE id = $1`,
          assetId
        );

        const subfinderUrl = process.env.SUBFINDER_API_URL || "http://127.0.0.1:8085";
        
        let subdomains: string[] = [];

        try {
          // Using typical subfinder external endpoint, expecting it handles POST {"domain": "..."}
          const response = await fetch(`${subfinderUrl}/subdomains`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain })
          });

          if (!response.ok) {
            throw new Error(`Subfinder returned ${response.status} ${response.statusText}`);
          }

          const textResponse = await response.text();
          let data;
          try {
            data = JSON.parse(textResponse);
          } catch (e) {
            throw new Error("Invalid JSON from Subfinder API");
          }
          
          if (Array.isArray(data)) subdomains = data;
          else if (data && typeof data === 'object') {
            if (Array.isArray(data.subdomains)) subdomains = data.subdomains;
            else if (Array.isArray(data.data)) subdomains = data.data;
            else if (Array.isArray(data.result)) subdomains = data.result;
            // Some scanners wrap their response array
          }

        } catch (fetchErr: any) {
          console.error("Discover API fetch error:", fetchErr);
          sendEvent("error", {
            code: "SUBFINDER_UNAVAILABLE",
            message: `Subfinder failed: ${fetchErr.message}`,
          });
          if(keepAliveInterval) clearInterval(keepAliveInterval);
          try { controller.close(); } catch(e){}
          return;
        }

        if(keepAliveInterval) clearInterval(keepAliveInterval);

        const uniqueSubdomains = [...new Set(subdomains)].filter(sub => typeof sub === 'string' && sub.trim().length > 0 && sub !== domain);

        const newAssets = [];
        for (const sub of uniqueSubdomains) {
          try {
            const leafId = crypto.randomUUID();
            const bucket = inferAssetBucket(sub);
            await prisma.$executeRawUnsafe(
              `INSERT INTO "asset" (id, value, type, "isRoot", "organizationId", verified, "openPorts", bucket, "createdAt", "parentId")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              leafId,
              sub,
              getAssetType(sub),
              false,
              orgId,
              false,
              JSON.stringify([{ number: 443, protocol: "tcp" }]),
              bucket,
              new Date(),
              assetId
            ).catch(async (dbError: any) => {
              const missingBucketColumn =
                typeof dbError?.message === "string" &&
                dbError.message.includes(`column "bucket" of relation "asset" does not exist`);

              if (!missingBucketColumn) throw dbError;

              await prisma.$executeRawUnsafe(
                `INSERT INTO "asset" (id, value, type, "isRoot", "organizationId", verified, "openPorts", "createdAt", "parentId")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                leafId,
                sub,
                getAssetType(sub),
                false,
                orgId,
                false,
                JSON.stringify([{ number: 443, protocol: "tcp" }]),
                new Date(),
                assetId
              );
            });
            newAssets.push({
              id: leafId,
              value: sub,
              type: getAssetType(sub),
              parentId: assetId,
              bucket,
              addedAt: new Date().toISOString(),
              resolvedIp: null,
              openPorts: JSON.stringify([{ number: 443, protocol: "tcp" }]),
            });
          } catch (dbErr: any) {
            // Probably unqiue constraint, skip
          }
        }

        // Mark DB as idle
        await prisma.$executeRawUnsafe(
          `UPDATE "asset" SET "scanStatus" = 'idle', "lastScanDate" = $1 WHERE id = $2`,
          new Date(),
          assetId
        );

        sendEvent("done", { subdomains: newAssets });
        
        try { controller.close(); } catch(e){}
      } catch (err: any) {
        sendEvent("error", { message: err.message || "Unknown error" });
        if(keepAliveInterval) clearInterval(keepAliveInterval);
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "asset" SET "scanStatus" = 'failed' WHERE id = $1`,
            assetId
          );
        } catch(e){}
        try { controller.close(); } catch(e){}
      }
    },
    cancel() {
      // Client aborted stream
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
