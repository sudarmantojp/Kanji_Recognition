'use client'

import { Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HistoryItem {
  id: string
  detected_text: string
  translation: string
  timestamp: number
  thumbnail?: string
}

interface HistoryPanelProps {
  history: HistoryItem[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
  activeId?: string
}

export function HistoryPanel({
  history,
  onSelect,
  onDelete,
  onClearAll,
  activeId,
}: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
        <Clock className="w-8 h-8 opacity-30" />
        <p className="text-sm">No scans yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {history.length} scan{history.length !== 1 ? 's' : ''}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
        >
          Clear all
        </Button>
      </div>
      <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-0.5">
        {history.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
              activeId === item.id
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:bg-accent/30'
            }`}
          >
            {/* Thumbnail */}
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt="Scan thumbnail"
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-lg font-bold text-muted-foreground">
                {item.detected_text.charAt(0) || '?'}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{item.detected_text}</p>
              <p className="text-xs text-muted-foreground truncate">{item.translation}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Delete */}
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
              className="w-7 h-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
