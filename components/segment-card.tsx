'use client'

interface Segment {
  kanji: string
  furigana: string
  romaji: string
  meaning: string
  type: string
}

interface SegmentCardProps {
  segment: Segment
  index: number
}

const typeColors: Record<string, string> = {
  kanji: 'bg-rose-100 text-rose-700 border-rose-200',
  mixed: 'bg-orange-100 text-orange-700 border-orange-200',
  hiragana: 'bg-sky-100 text-sky-700 border-sky-200',
  katakana: 'bg-violet-100 text-violet-700 border-violet-200',
}

export function SegmentCard({ segment, index }: SegmentCardProps) {
  const colorClass = typeColors[segment.type] || 'bg-muted text-muted-foreground border-border'

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors">
      {/* Number */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
        {index + 1}
      </div>

      {/* Kanji with furigana */}
      <div className="flex flex-col items-center min-w-[60px]">
        <span className="text-[10px] text-accent-foreground font-medium leading-none mb-0.5 min-h-[12px]">
          {segment.type === 'kanji' || segment.type === 'mixed' ? segment.furigana : ''}
        </span>
        <span className="text-2xl font-bold text-foreground leading-none">
          {segment.kanji}
        </span>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground italic">{segment.romaji}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${colorClass}`}>
            {segment.type}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground mt-0.5 truncate">{segment.meaning}</p>
      </div>
    </div>
  )
}
