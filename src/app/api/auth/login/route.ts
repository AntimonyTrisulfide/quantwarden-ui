import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const user = await prisma.user.findUnique({
    where: { email: body.email },
  });

  if (!user || user.password !== body.password) {
    return NextResponse.json({ success: false });
  }

  const domain = body.email.split("@")[1];

  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
  });

  if (!org?.domains.includes(domain)) {
    return NextResponse.json({ success: false });
  }

  return NextResponse.json({ success: true });
}