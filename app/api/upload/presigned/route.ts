export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { generatePresignedUploadUrl } from "@/lib/s3";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, contentType } = body ?? {};

    if (!fileName || !contentType) {
      return NextResponse.json({ error: "fileName and contentType required" }, { status: 400 });
    }

    // Videos are public so FFmpeg API can access them
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      fileName,
      contentType,
      true
    );

    return NextResponse.json({ uploadUrl, cloud_storage_path });
  } catch (error: any) {
    console.error("Presigned URL error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to generate upload URL" }, { status: 500 });
  }
}
