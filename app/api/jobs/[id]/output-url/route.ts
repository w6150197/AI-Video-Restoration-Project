export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    if (job?.status !== "COMPLETED" || !job?.outputPath) {
      return NextResponse.json({ error: "Not ready" }, { status: 400 });
    }

    // The outputPath from FFmpeg API is already a CDN URL
    return NextResponse.json({ url: job.outputPath });
  } catch (error: any) {
    console.error("Output URL error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
