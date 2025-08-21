"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ResponsiveModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}

export function ResponsiveModal({ 
  isOpen, 
  onClose, 
  title, 
  subtitle,
  children, 
  className = "" 
}: ResponsiveModalProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent 
          side="bottom" 
          className={`p-0 ${className}`}
          style={{
            maxHeight: '80vh'
          }}
        >
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4" />
          
          <SheetHeader className="px-4 pb-3 border-b border-gray-100 flex-shrink-0">
            <SheetTitle className="text-base font-semibold text-app-neutral text-left">
              {title}
            </SheetTitle>
            {subtitle && (
              <p className="text-xs text-gray-600 text-left">
                {subtitle}
              </p>
            )}
          </SheetHeader>
          
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-lg mx-auto max-h-[90vh] overflow-y-auto ${className}`}>
        <DialogHeader className="border-b border-gray-100 pb-4">
          <DialogTitle className="text-lg font-semibold text-app-neutral">
            {title}
          </DialogTitle>
          {subtitle && (
            <p className="text-sm text-gray-600">
              {subtitle}
            </p>
          )}
        </DialogHeader>
        
        <div className="overflow-y-auto">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook for drag-to-dismiss functionality
export function useDragToDismiss(onDismiss: () => void, threshold = 100) {
  const [dragStart, setDragStart] = React.useState<number | null>(null)
  const [dragY, setDragY] = React.useState(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only start drag from the header area, not from scrollable content
    const target = e.target as HTMLElement
    if (target.closest('[data-scrollable]')) {
      return
    }
    setDragStart(e.touches[0].clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStart === null) return
    
    const currentY = e.touches[0].clientY
    const deltaY = currentY - dragStart
    
    // Only allow dragging down and not from scrollable areas
    if (deltaY > 0) {
      setDragY(deltaY)
      // Prevent scrolling only when actually dragging the sheet
      e.preventDefault()
    }
  }

  const handleTouchEnd = () => {
    if (dragY > threshold) {
      onDismiss()
    }
    setDragStart(null)
    setDragY(0)
  }

  return {
    dragY,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    }
  }
}