export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { initiateMultipartUpload } from "@/lib/s3";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, contentType } = body ?? {};

    if (!fileName || !contentType) {
      return NextResponse.json({ error: "fileName and contentType required" }, { status: 400 });
    }

    const result = await initiateMultipartUpload(fileName, contentType, true);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Multipart initiate error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
