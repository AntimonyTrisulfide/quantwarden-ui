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

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: session.user.id }
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assets = await prisma.nmapAsset.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("Nmap Asset fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, target } = await req.json();

    if (!orgId || !target) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify permissions
    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: session.user.id }
    });

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Only owners and admins can add assets." }, { status: 403 });
    }

    // Create the asset
    const asset = await prisma.nmapAsset.create({
      data: {
        organizationId: orgId,
        target: target,
      }
    });

    return NextResponse.json({ success: true, asset });
  } catch (error: any) {
    // Ignore unique constraint violation
    if (error.code === 'P2002') {
       return NextResponse.json({ success: true });
    }
    console.error("Nmap Asset insert error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const orgId = searchParams.get("orgId");

    if (!id || !orgId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: session.user.id }
    });

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Only owners and admins can remove assets." }, { status: 403 });
    }

    await prisma.nmapAsset.deleteMany({
      where: {
        id,
        organizationId: orgId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Nmap Asset delete error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
