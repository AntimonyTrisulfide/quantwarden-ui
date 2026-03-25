import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const { orgId } = await req.json();

  const token = crypto.randomBytes(16).toString("hex");

  await prisma.invite.create({
    data: {
      orgId,
      token,
    },
  });

  return NextResponse.json({
    link: `http://localhost:3000/login?orgId=${orgId}&token=${token}`,
  });
}