'use client'

import { Sliders, Target, Clock, Paintbrush, Eraser } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

interface ProcessingControlsProps {
  sensitivity: number
  stability: number
  inpaintRadius: number
  denoiseStrength: number
  onSensitivityChange: (v: number) => void
  onStabilityChange: (v: number) => void
  onInpaintRadiusChange: (v: number) => void
  onDenoiseStrengthChange: (v: number) => void
  disabled?: boolean
}

export function ProcessingControls({
  sensitivity,
  stability,
  inpaintRadius,
  denoiseStrength,
  onSensitivityChange,
  onStabilityChange,
  onInpaintRadiusChange,
  onDenoiseStrengthChange,
  disabled,
}: ProcessingControlsProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-4">
        <Sliders className="h-5 w-5 text-[#FEBE10]" />
        <h3 className="text-sm font-display font-semibold tracking-tight">Processing Controls</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#002C72] dark:text-[#FEBE10]" />
            <Label className="text-sm">Spot Detection Sensitivity</Label>
          </div>
          <span className="text-xs font-mono text-muted-foreground w-8 text-right">{sensitivity}</span>
        </div>
        <Slider
          value={[sensitivity]}
          onValueChange={(v: number[]) => onSensitivityChange(v?.[0] ?? 30)}
          min={5}
          max={80}
          step={1}
          disabled={disabled}
          className="[&_[role=slider]]:bg-[#FEBE10] [&_[role=slider]]:border-[#002C72]"
        />
        <p className="text-[11px] text-muted-foreground">How much darker than its surroundings a spot must be (higher = catches fainter smudges)</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#002C72] dark:text-[#FEBE10]" />
            <Label className="text-sm">Spot Stability</Label>
          </div>
          <span className="text-xs font-mono text-muted-foreground w-8 text-right">{stability}%</span>
        </div>
        <Slider
          value={[stability]}
          onValueChange={(v: number[]) => onStabilityChange(v?.[0] ?? 70)}
          min={30}
          max={100}
          step={5}
          disabled={disabled}
          className="[&_[role=slider]]:bg-[#FEBE10] [&_[role=slider]]:border-[#002C72]"
        />
        <p className="text-[11px] text-muted-foreground">% of the clip a spot must stay in place. Moving objects fall below this and are ignored (higher = stricter)</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paintbrush className="h-4 w-4 text-[#002C72] dark:text-[#FEBE10]" />
            <Label className="text-sm">Inpainting Radius</Label>
          </div>
          <span className="text-xs font-mono text-muted-foreground w-8 text-right">{inpaintRadius}px</span>
        </div>
        <Slider
          value={[inpaintRadius]}
          onValueChange={(v: number[]) => onInpaintRadiusChange(v?.[0] ?? 5)}
          min={2}
          max={15}
          step={1}
          disabled={disabled}
          className="[&_[role=slider]]:bg-[#FEBE10] [&_[role=slider]]:border-[#002C72]"
        />
        <p className="text-[11px] text-muted-foreground">Radius of the area around each spot used for reconstruction</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eraser className="h-4 w-4 text-[#002C72] dark:text-[#FEBE10]" />
            <Label className="text-sm">Denoising Strength</Label>
          </div>
          <span className="text-xs font-mono text-muted-foreground w-8 text-right">{denoiseStrength}</span>
        </div>
        <Slider
          value={[denoiseStrength]}
          onValueChange={(v: number[]) => onDenoiseStrengthChange(v?.[0] ?? 10)}
          min={0}
          max={30}
          step={1}
          disabled={disabled}
          className="[&_[role=slider]]:bg-[#FEBE10] [&_[role=slider]]:border-[#002C72]"
        />
        <p className="text-[11px] text-muted-foreground">Additional noise reduction for cleaner output (0 = none)</p>
      </div>
    </div>
  )
}
