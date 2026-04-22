'use client'

interface Segment {
  kanji: string
  furigana: string
  romaji: string
  meaning: string
  type: string
}

interface FuriganaTextProps {
  segments: Segment[]
  showRomaji?: boolean
  showMeaning?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeConfig = {
  sm: {
    kanji: 'text-lg',
    furigana: 'text-[9px]',
    romaji: 'text-[10px]',
    meaning: 'text-[10px]',
    gap: 'gap-2',
  },
  md: {
    kanji: 'text-2xl',
    furigana: 'text-[11px]',
    romaji: 'text-xs',
    meaning: 'text-xs',
    gap: 'gap-3',
  },
  lg: {
    kanji: 'text-3xl',
    furigana: 'text-xs',
    romaji: 'text-sm',
    meaning: 'text-sm',
    gap: 'gap-4',
  },
  xl: {
    kanji: 'text-4xl',
    furigana: 'text-sm',
    romaji: 'text-sm',
    meaning: 'text-base',
    gap: 'gap-5',
  },
}

export function FuriganaText({
  segments,
  showRomaji = true,
  showMeaning = false,
  size = 'md',
}: FuriganaTextProps) {
  const config = sizeConfig[size]

  return (
    <div className={`flex flex-wrap items-end ${config.gap}`}>
      {segments.map((seg, i) => (
        <div key={i} className="flex flex-col items-center">
          {/* Furigana above kanji */}
          <span
            className={`${config.furigana} text-accent-foreground font-medium leading-tight tracking-wider min-h-[1.2em] text-center`}
          >
            {seg.type === 'kanji' || seg.type === 'mixed' ? seg.furigana : ''}
          </span>

          {/* Main kanji/text */}
          <span
            className={`${config.kanji} font-bold text-foreground leading-none`}
          >
            {seg.kanji}
          </span>

          {/* Romaji below */}
          {showRomaji && (
            <span
              className={`${config.romaji} text-muted-foreground italic leading-tight mt-0.5`}
            >
              {seg.romaji}
            </span>
          )}

          {/* Meaning badge */}
          {showMeaning && seg.meaning && (
            <span
              className={`${config.meaning} bg-accent text-accent-foreground px-1.5 py-0.5 rounded mt-1 text-center max-w-[80px] truncate`}
              title={seg.meaning}
            >
              {seg.meaning}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
