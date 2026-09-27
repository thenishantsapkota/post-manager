import { Globe, MessageCircle, Share2, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { cx, mediaUrl } from './ui'

/** Approximation of how the post will look in the Facebook feed. */
export function FacebookPreview({
  pageName,
  logoMediaId,
  caption,
  mediaIds,
}: {
  pageName: string
  logoMediaId?: string
  caption: string
  mediaIds: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const long = caption.length > 280 || caption.split('\n').length > 6
  const shown = expanded || !long ? caption : `${caption.slice(0, 260).split('\n').slice(0, 5).join('\n')}…`
  const imgs = mediaIds.slice(0, 5)
  const extra = mediaIds.length - imgs.length

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white text-[#050505] shadow-sm">
      <div className="flex items-center gap-2.5 px-3 pt-3">
        {logoMediaId ? (
          <img src={mediaUrl(logoMediaId)} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <div className="grid size-10 place-items-center rounded-full bg-[#be123c] font-bold text-white">{pageName.slice(0, 1) || 'D'}</div>
        )}
        <div className="leading-tight">
          <p className="text-[15px] font-semibold">{pageName || 'Your page'}</p>
          <p className="flex items-center gap-1 text-[13px] text-[#65676b]">Just now · <Globe className="size-3" /></p>
        </div>
      </div>
      {caption && (
        <p className="whitespace-pre-wrap break-words px-3 py-2.5 text-[15px] leading-snug">
          {shown}
          {long && (
            <button type="button" className="ml-1 font-semibold text-[#65676b]" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'See less' : 'See more'}
            </button>
          )}
        </p>
      )}
      {imgs.length > 0 && (
        <div
          className={cx(
            'grid gap-0.5 bg-[#e4e6eb]',
            imgs.length === 1 && 'grid-cols-1',
            imgs.length === 2 && 'grid-cols-2',
            imgs.length >= 3 && 'grid-cols-2',
          )}
        >
          {imgs.map((id, i) => (
            <div
              key={`${id}-${i}`}
              className={cx(
                'relative overflow-hidden bg-[#f0f2f5]',
                imgs.length === 1 ? 'max-h-[520px]' : 'aspect-square',
                imgs.length === 3 && i === 0 && 'col-span-2 aspect-[2/1]',
              )}
            >
              <img src={mediaUrl(id)} alt="" className={cx('size-full', imgs.length === 1 ? 'object-contain' : 'object-cover')} />
              {i === imgs.length - 1 && extra > 0 && (
                <div className="absolute inset-0 grid place-items-center bg-black/45 text-3xl font-bold text-white">+{extra}</div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-around border-t border-[#ced0d4] px-2 py-1.5 text-[15px] font-semibold text-[#65676b]">
        <span className="flex items-center gap-1.5 py-1"><ThumbsUp className="size-4" /> Like</span>
        <span className="flex items-center gap-1.5 py-1"><MessageCircle className="size-4" /> Comment</span>
        <span className="flex items-center gap-1.5 py-1"><Share2 className="size-4" /> Share</span>
      </div>
    </div>
  )
}
