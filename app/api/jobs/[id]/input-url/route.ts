export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await prisma.job.findUnique({ where: { id } });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job?.inputPath) {
      return NextResponse.json({ error: "No input file" }, { status: 400 });
    }

    const url = await getFileUrl(
      job.inputPath,
      job?.contentType ?? "video/mp4",
      job?.inputIsPublic ?? true
    );

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("Input URL error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
