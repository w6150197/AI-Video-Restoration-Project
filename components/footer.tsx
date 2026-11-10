'use client'

import { Video } from 'lucide-react'

export function Footer() {
  return (
    <footer className="w-full bg-[#002C72] border-t border-[#002C72]/50 mt-auto">
      <div className="max-w-[1200px] mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-[#FEBE10]" />
          <span className="text-sm text-[#D2C4C3]">
            HCC<span className="text-[#FEBE10]">TV</span> Video Restoration Tool
          </span>
        </div>
        <p className="text-xs text-[#D2C4C3]/70">
          Houston Community College &middot; Television Production
        </p>
      </div>
    </footer>
  )
}
