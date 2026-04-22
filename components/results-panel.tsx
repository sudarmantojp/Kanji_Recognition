'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check, BookOpen, List, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FuriganaText } from '@/components/furigana-text'
import { SegmentCard } from '@/components/segment-card'

interface Segment {
  kanji: string
  furigana: string
  romaji: string
  meaning: string
  type: string
}

interface ScanResult {
  detected_text: string
  segments: Segment[]
  translation: string
  language_notes?: string
}

interface ResultsPanelProps {
  result: ScanResult
  capturedImage?: string
}

type ViewMode = 'furigana' | 'segments' | 'translation'

export function ResultsPanel({ result, capturedImage }: ResultsPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('furigana')
  const [showRomaji, setShowRomaji] = useState(true)
  const [showMeaning, setShowMeaning] = useState(false)
  const [showImage, setShowImage] = useState(true)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.detected_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  if (!result.segments || result.segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
        <Languages className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium">{result.translation || 'No Japanese text detected'}</p>
        {result.detected_text && (
          <p className="text-xs text-center px-4">{result.detected_text}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Captured image thumbnail */}
      {capturedImage && (
        <div className="rounded-xl overflow-hidden border border-border shadow-sm">
          <button
            className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-sm font-medium text-muted-foreground"
            onClick={() => setShowImage((v) => !v)}
          >
            <span>Captured Image</span>
            {showImage ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showImage && (
            <img
              src={capturedImage}
              alt="Captured image for kanji scanning"
              className="w-full max-h-48 object-contain bg-black"
            />
          )}
        </div>
      )}

      {/* Detected raw text */}
      <div className="flex items-center justify-between gap-2 bg-muted/40 rounded-xl px-4 py-3 border border-border">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">Detected Text</p>
          <p className="text-base font-medium text-foreground truncate">{result.detected_text}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          className="flex-shrink-0 w-8 h-8"
          title="Copy text"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      {/* View mode tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {(
          [
            { id: 'furigana', label: 'Furigana', icon: <BookOpen className="w-3.5 h-3.5" /> },
            { id: 'segments', label: 'Segments', icon: <List className="w-3.5 h-3.5" /> },
            { id: 'translation', label: 'Translation', icon: <Languages className="w-3.5 h-3.5" /> },
          ] as { id: ViewMode; label: string; icon: React.ReactNode }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              viewMode === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Furigana view */}
      {viewMode === 'furigana' && (
        <div className="flex flex-col gap-3">
          {/* Options */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowRomaji((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                showRomaji
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground'
              }`}
            >
              Romaji
            </button>
            <button
              onClick={() => setShowMeaning((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                showMeaning
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground'
              }`}
            >
              Meanings
            </button>
          </div>

          {/* Furigana display */}
          <div className="bg-card border border-border rounded-xl p-5 min-h-[80px] flex items-center justify-center">
            <FuriganaText
              segments={result.segments}
              showRomaji={showRomaji}
              showMeaning={showMeaning}
              size="lg"
            />
          </div>
        </div>
      )}

      {/* Segments view */}
      {viewMode === 'segments' && (
        <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-0.5">
          {result.segments.map((seg, i) => (
            <SegmentCard key={i} segment={seg} index={i} />
          ))}
        </div>
      )}

      {/* Translation view */}
      {viewMode === 'translation' && (
        <div className="flex flex-col gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">English Translation</p>
            <p className="text-base text-foreground leading-relaxed">{result.translation}</p>
          </div>
          {result.language_notes && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-1.5 font-medium uppercase tracking-wide">Language Notes</p>
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{result.language_notes}</p>
            </div>
          )}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Word-by-word</p>
            <div className="flex flex-col gap-1">
              {result.segments.map((seg, i) => (
                <div key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="font-bold text-foreground w-20 flex-shrink-0">{seg.kanji}</span>
                  <span className="text-muted-foreground italic w-24 flex-shrink-0">{seg.romaji}</span>
                  <span className="text-foreground">{seg.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
