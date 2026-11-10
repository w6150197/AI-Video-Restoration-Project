'use client'

import { Video, Sparkles } from 'lucide-react'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#002C72]/95 backdrop-blur-md border-b border-[#002C72]">
      <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#FEBE10] rounded-lg p-2">
            <Video className="h-5 w-5 text-[#002C72]" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-white tracking-tight leading-none">
              HCC<span className="text-[#FEBE10]">TV</span>
            </h1>
            <p className="text-[10px] text-[#D2C4C3] tracking-widest uppercase leading-none mt-0.5">
              Video Restoration
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#FEBE10]" />
          <span className="text-sm text-[#D2C4C3] hidden sm:inline">AI-Powered Lens Spot Removal</span>
        </div>
      </div>
    </header>
  )
}
