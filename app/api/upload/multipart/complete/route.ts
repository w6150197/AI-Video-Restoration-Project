export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { completeMultipartUpload } from "@/lib/s3";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cloud_storage_path, uploadId, parts } = body ?? {};

    if (!cloud_storage_path || !uploadId || !parts) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await completeMultipartUpload(cloud_storage_path, uploadId, parts);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Multipart complete error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
