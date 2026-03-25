import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const org = await prisma.organization.create({
    data: {
      name: body.orgName,
      domains: body.domains.split(",").map((d: string) => d.trim()),
    },
  });

  await prisma.user.create({
    data: {
      email: body.email,
      password: body.password,
      role: "admin",
      orgId: org.id,
    },
  });

  return NextResponse.json({ success: true });
}