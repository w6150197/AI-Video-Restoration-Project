export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPresignedUrlForPart } from "@/lib/s3";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cloud_storage_path, uploadId, partNumber } = body ?? {};

    if (!cloud_storage_path || !uploadId || !partNumber) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const url = await getPresignedUrlForPart(cloud_storage_path, uploadId, partNumber);
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("Multipart part error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
