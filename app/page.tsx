'use client'

import { useState, useCallback } from 'react'
import { BookOpen, ScanLine, History, Info } from 'lucide-react'
import { CameraScanner } from '@/components/camera-scanner'
import { ResultsPanel } from '@/components/results-panel'
import { HistoryPanel } from '@/components/history-panel'

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

interface HistoryItem {
  id: string
  detected_text: string
  translation: string
  timestamp: number
  thumbnail?: string
  result: ScanResult
  image?: string
}

type Tab = 'scan' | 'result' | 'history'

export default function KanjiScannerPage() {
  const [activeTab, setActiveTab] = useState<Tab>('scan')
  const [isScanning, setIsScanning] = useState(false)
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null)
  const [currentImage, setCurrentImage] = useState<string | undefined>(undefined)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem('kanji_scan_history')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const saveHistory = useCallback((items: HistoryItem[]) => {
    try {
      // Limit stored thumbnails size: only store last 20
      const toSave = items.slice(0, 20).map((item) => ({
        ...item,
        thumbnail: item.thumbnail?.substring(0, 5000), // limit size
      }))
      localStorage.setItem('kanji_scan_history', JSON.stringify(toSave))
    } catch {
      // Storage might be full
    }
  }, [])

  const handleCapture = useCallback(async (imageBase64: string) => {
    setIsScanning(true)
    setError(null)
    setCurrentImage(imageBase64)

    try {
      const response = await fetch('/api/scan-kanji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to analyze image')
      }

      const result: ScanResult = data
      setCurrentResult(result)

      // Add to history
      const id = crypto.randomUUID()
      const newItem: HistoryItem = {
        id,
        detected_text: result.detected_text || '(no text)',
        translation: result.translation || '',
        timestamp: Date.now(),
        thumbnail: imageBase64.substring(0, 3000),
        result,
        image: imageBase64,
      }
      const updated = [newItem, ...history]
      setHistory(updated)
      saveHistory(updated)
      setActiveHistoryId(id)
      setActiveTab('result')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
      setError(msg)
      console.error('[v0] Scan error:', err)
    } finally {
      setIsScanning(false)
    }
  }, [history, saveHistory])

  const handleSelectHistory = useCallback((id: string) => {
    const item = history.find((h) => h.id === id)
    if (item) {
      setCurrentResult(item.result)
      setCurrentImage(item.image)
      setActiveHistoryId(id)
      setActiveTab('result')
    }
  }, [history])

  const handleDeleteHistory = useCallback((id: string) => {
    const updated = history.filter((h) => h.id !== id)
    setHistory(updated)
    saveHistory(updated)
    if (activeHistoryId === id) {
      setActiveHistoryId(undefined)
    }
  }, [history, activeHistoryId, saveHistory])

  const handleClearHistory = useCallback(() => {
    setHistory([])
    setActiveHistoryId(undefined)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kanji_scan_history')
    }
  }, [])

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-none">Kanji Scanner</h1>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">with Furigana</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Stats badge */}
            {history.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                {history.length} scanned
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="sticky top-14 z-10 bg-background border-b border-border">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex">
            {(
              [
                { id: 'scan', label: 'Scanner', icon: <ScanLine className="w-4 h-4" /> },
                { id: 'result', label: 'Result', icon: <BookOpen className="w-4 h-4" />, badge: currentResult ? '✓' : undefined },
                { id: 'history', label: 'History', icon: <History className="w-4 h-4" />, badge: history.length > 0 ? String(history.length) : undefined },
              ] as { id: Tab; label: string; icon: React.ReactNode; badge?: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge && (
                  <span className="absolute top-1.5 right-5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5">
        {/* Scanner Tab */}
        {activeTab === 'scan' && (
          <div className="flex flex-col gap-5">
            <CameraScanner onCapture={handleCapture} isScanning={isScanning} />

            {error && (
              <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                <Info className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* How to use */}
            <div className="bg-muted/40 border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">How to use</p>
              <ol className="flex flex-col gap-1.5 text-sm text-muted-foreground list-none">
                {[
                  'Start your camera or upload a photo',
                  'Point at Japanese text (kanji, signs, books, etc.)',
                  'Tap "Scan Kanji" to analyze',
                  'View furigana readings & translation',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Result Tab */}
        {activeTab === 'result' && (
          <div>
            {currentResult ? (
              <ResultsPanel result={currentResult} capturedImage={currentImage} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <ScanLine className="w-16 h-16 opacity-20" />
                <p className="text-sm font-medium">No scan result yet</p>
                <p className="text-xs text-center">Go to the Scanner tab and capture Japanese text to see results here.</p>
                <button
                  onClick={() => setActiveTab('scan')}
                  className="mt-2 text-sm text-primary underline underline-offset-4"
                >
                  Start scanning
                </button>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <HistoryPanel
            history={history}
            onSelect={handleSelectHistory}
            onDelete={handleDeleteHistory}
            onClearAll={handleClearHistory}
            activeId={activeHistoryId}
          />
        )}
      </div>
    </main>
  )
}
