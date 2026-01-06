"use client"

import { Monitor, Smartphone } from "lucide-react"

export function MobileMessage() {
  return (
    <div className="md:hidden fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Smartphone className="h-16 w-16 text-slate-400" />
            <Monitor className="h-8 w-8 text-slate-600 absolute -bottom-2 -right-2 bg-white rounded-full p-1" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">
          Desktop App Required
        </h2>
        <p className="text-slate-600 mb-6">
          This application is designed for desktop use. Please switch to a desktop or laptop computer for the best experience.
        </p>
        <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700">
          <p className="font-semibold mb-1">Why desktop?</p>
          <p>This app requires a larger screen and desktop features to function properly.</p>
        </div>
      </div>
    </div>
  )
}

