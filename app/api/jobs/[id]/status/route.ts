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

    return NextResponse.json({
      id: job?.id,
      status: job?.status,
      progress: job?.progress ?? 0,
      statusMessage: job?.statusMessage ?? "",
      outputPath: job?.outputPath ?? "",
      outputIsPublic: job?.outputIsPublic ?? true,
      maskPath: job?.maskPath ?? "",
      errorMessage: job?.errorMessage ?? "",
    });
  } catch (error: any) {
    console.error("Status error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
