export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      inputPath,
      originalName,
      contentType,
      sensitivity,
      stability,
      inpaintRadius,
      denoiseStrength,
    } = body ?? {};

    if (!inputPath || !originalName) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const job = await prisma.job.create({
      data: {
        status: "PENDING",
        progress: 0,
        statusMessage: "Job created, waiting to start...",
        inputPath: inputPath ?? "",
        inputIsPublic: true,
        originalName: originalName ?? "",
        contentType: contentType ?? "video/mp4",
        sensitivity: sensitivity ?? 30,
        stability: stability ?? 70,
        inpaintRadius: inpaintRadius ?? 5,
        denoiseStrength: denoiseStrength ?? 10,
      },
    });

    return NextResponse.json({ jobId: job?.id });
  } catch (error: any) {
    console.error("Create job error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to create job" }, { status: 500 });
  }
}
