# HCCTV Video Restoration Tool

A browser-based tool for HCC TV that removes stationary black spots caused by a dirty or damaged camera lens, including on footage with camera or subject motion. Upload a clip, compare before/after side by side, tune the sliders, and download an H.264 MP4 ready for Adobe Premiere Pro.

## How spot removal works
1. Frames are sampled evenly across the clip.
2. Pixels clearly darker than their surroundings are flagged in each sample.
3. Only pixels flagged in at least the *Spot Stability* % of samples become the lens-spot mask, so moving dark objects are ignored.
4. The mask is grown by the *Inpainting Radius* and only those pixels are inpainted in every frame (FFmpeg `removelogo`), with optional `hqdn3d` denoising.

## Controls
- **Spot Detection Sensitivity**: how much darker than its surroundings a spot must be
- **Spot Stability**: % of the clip a spot must stay in place
- **Inpainting Radius**: how far the repair extends around each spot
- **Denoising Strength**: extra noise reduction (0 = off)

## Tech
Next.js 16 (App Router), Prisma + PostgreSQL (job tracking), S3 presigned uploads, Abacus.AI hosted FFmpeg API for processing.

## Running locally
```bash
cp .env.example .env   # fill in your values
yarn install
yarn prisma generate
yarn prisma db push
yarn dev
```

## Colors (Houston City College)
Lightning Yellow `#FEBE10`, Midnight Blue `#002C72`, Cold Turkey `#D2C4C3`, White `#FFFFFF`.
