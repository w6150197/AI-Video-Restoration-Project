export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

const FFMPEG_API_BASE = "https://apps.abacus.ai/api";
const API_KEY = process.env.ABACUSAI_API_KEY ?? "";

async function callFfmpeg(
  input_files: Record<string, string>,
  output_files: Record<string, string>,
  ffmpeg_command: string,
  maxWaitSeconds: number = 600
): Promise<Record<string, string>> {
  const createRes = await fetch(`${FFMPEG_API_BASE}/createRunFfmpegCommandRequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ input_files, output_files, ffmpeg_command, max_command_run_seconds: maxWaitSeconds }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({ error: "FFmpeg request failed" }));
    throw new Error(err?.error ?? "FFmpeg request failed");
  }

  const { request_id } = await createRes.json();
  if (!request_id) throw new Error("No request_id returned");

  let attempts = 0;
  const maxAttempts = maxWaitSeconds;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 1000));
    const statusRes = await fetch(`${FFMPEG_API_BASE}/getRunFfmpegCommandStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ request_id }),
    });

    const statusResult = await statusRes.json();
    const status = statusResult?.status ?? "FAILED";
    const result = statusResult?.result ?? null;

    if (status === "SUCCESS") {
      if (result?.result) return result.result;
      throw new Error("FFmpeg completed but no output");
    } else if (status === "FAILED") {
      throw new Error(result?.error ?? "FFmpeg processing failed");
    }
    attempts++;
  }
  throw new Error("FFmpeg processing timed out");
}

async function updateJob(id: string, data: Record<string, any>) {
  try {
    await prisma.job.update({ where: { id }, data });
  } catch (e: any) {
    console.error("Failed to update job:", e?.message);
  }
}

/**
 * Motion-safe lens spot restoration pipeline.
 *
 * Lens dirt/damage stays at the SAME pixel position in every frame while the
 * scene (subjects, camera pans) moves underneath it. So instead of treating
 * every dark pixel as a spot, we:
 *  1. Sample frames evenly across the whole clip (downscaled for analysis).
 *  2. Per sample, flag pixels noticeably darker than their local neighbourhood
 *     (relative darkness, so it works on bright and dark backgrounds).
 *  3. Average those flags over time (tmix). Moving dark objects only occupy a
 *     pixel briefly; lens spots occupy it nearly always. Pixels flagged in at
 *     least `stability`% of samples form a single static mask.
 *  4. Clean speckles, grow the mask by the inpainting radius, scale to source size.
 *  5. Inpaint ONLY the masked pixels in every frame with removelogo — the rest
 *     of the image (including all motion) is left untouched.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job?.status === "PROCESSING") {
      return NextResponse.json({ error: "Already processing" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    // Optional manual repair for a known stationary sensor blemish.
    // Coordinates refer to ORIGINAL video pixels, not the scaled preview.
    const manual = body?.manualSpot;
    const manualEnabled = manual?.enabled === true;
    const videoWidth = Number(body?.videoWidth);
    const videoHeight = Number(body?.videoHeight);
    const x = Number(manual?.x);
    const y = Number(manual?.y);
    const radius = Number(manual?.radius);
    if (manualEnabled && (!Number.isInteger(videoWidth) || !Number.isInteger(videoHeight) ||
      videoWidth < 16 || videoHeight < 16 || videoWidth > 8192 || videoHeight > 8192 ||
      !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 ||
      x >= videoWidth || y >= videoHeight || !Number.isInteger(radius) || radius < 2 || radius > 80)) {
      return NextResponse.json({ error: "Invalid manual spot coordinates or video dimensions" }, { status: 400 });
    }
    const rawDuration = Number(body?.duration);
    const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 60;

    await updateJob(id, { status: "PROCESSING", progress: 5, statusMessage: "Preparing video...", maskPath: "" });

    const inputUrl = await getFileUrl(
      job.inputPath,
      job?.contentType ?? "video/mp4",
      job?.inputIsPublic ?? true
    );

    const sensitivity = Math.max(5, Math.min(80, job?.sensitivity ?? 30));
    const stability = Math.max(30, Math.min(100, job?.stability ?? 70));
    const inpaintRadius = Math.max(2, Math.min(15, job?.inpaintRadius ?? 5));
    const denoiseStrength = Math.max(0, Math.min(30, job?.denoiseStrength ?? 10));

    // Sampling: ~4 samples/sec, between 12 and 150 samples over the whole clip
    const samples = Math.max(12, Math.min(150, Math.round(duration * 4)));
    const sampleFps = (samples / duration).toFixed(4);
    const tmixFrames = Math.max(2, samples - 1);

    // A pixel counts as "spot-like" when it is darker than ratio × local average
    const darkRatio = (0.5 + sensitivity / 200).toFixed(3); // 30 → 0.65 (35% darker)
    const stableLevel = Math.round((stability / 100) * 255);
    const growSigma = Math.max(1, inpaintRadius * 0.6).toFixed(2);

    await updateJob(id, { progress: 15, statusMessage: "Scanning frames across the clip for fixed lens spots (ignoring motion)..." });

    let maskResult: Record<string, string>;
    if (manualEnabled) {
      // Construct the mask at full source resolution. A circle-like ellipse
      // covers the dark core AND its faint gray halo; no downsampling/erosion.
      const safeRadius = Math.min(radius, x, y, videoWidth - 1 - x, videoHeight - 1 - y);
      const r = Math.max(2, safeRadius);
      const expr = `if(lte((X-${x})*(X-${x})+(Y-${y})*(Y-${y}),${r*r}),255,0)`;
      await updateJob(id, { progress: 20, statusMessage: "Creating full-resolution mask for the selected gray spot..." });
      maskResult = await callFfmpeg(
        {},
        { out_1: "lens_spot_mask.png" },
        `-f lavfi -i "color=c=black:s=${videoWidth}x${videoHeight}:r=1" -vf "format=gray,geq=lum='${expr}'" -frames:v 1 -update 1 {{out_1}}`,
        120
      );
    } else {
      const maskFilter = [
        `[0:v]split[ref][work]`,
        `[work]fps=${sampleFps},scale=1280:-2,format=gray,split[a][b]`,
        `[b]gblur=sigma=12[bg]`,
        `[a][bg]blend=all_expr='if(lt(A,B*${darkRatio})*gt(B-A,6),255,0)',tmix=frames=${tmixFrames},lut=y='if(gte(val,${stableLevel}),255,0)',dilation,dilation,gblur=sigma=${growSigma},lut=y='if(gt(val,16),255,0)'[small]`,
        `[small][ref]scale2ref=flags=neighbor[mask][refout]`,
        `[refout]nullsink`,
      ].join(";");
      maskResult = await callFfmpeg(
        { in_1: inputUrl },
        { out_1: "lens_spot_mask.png" },
        `-i {{in_1}} -filter_complex "${maskFilter}" -map "[mask]" -pix_fmt gray -update 1 {{out_1}}`,
        600
      );
    }
    const maskUrl = maskResult?.out_1;
    if (!maskUrl) throw new Error("Spot detection produced no mask");

    await updateJob(id, {
      progress: 45,
      maskPath: maskUrl,
      statusMessage: "Lens spot mask built. Inpainting spots in every frame (this may take a few minutes)...",
    });

    const denoise = denoiseStrength > 0
      ? `,hqdn3d=${(denoiseStrength * 0.3).toFixed(2)}:${(denoiseStrength * 0.25).toFixed(2)}:${(denoiseStrength * 0.3).toFixed(2)}:${(denoiseStrength * 0.25).toFixed(2)}`
      : "";

    const restoreResult = await callFfmpeg(
      { in_1: inputUrl, in_2: maskUrl },
      { out_1: "restored_video.mp4" },
      `-i {{in_1}} -vf "removelogo=f={{in_2}}${denoise}" -map 0:v:0 -map 0:a? -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 320k -movflags +faststart {{out_1}}`,
      600
    );

    const restoredUrl = restoreResult?.out_1;
    if (!restoredUrl) {
      throw new Error("Restoration produced no output");
    }

    await updateJob(id, {
      progress: 90,
      statusMessage: "Finalizing restored video...",
      outputPath: restoredUrl,
      outputIsPublic: true,
    });

    await updateJob(id, {
      status: "COMPLETED",
      progress: 100,
      statusMessage: "Restoration complete! Your video is ready for download.",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Processing error:", error);
    await updateJob(id, {
      status: "FAILED",
      progress: 0,
      statusMessage: "Processing failed",
      errorMessage: error?.message ?? "Unknown error",
    });
    return NextResponse.json({ error: error?.message ?? "Processing failed" }, { status: 500 });
  }
}
