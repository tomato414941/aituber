import { useEffect, useRef } from 'react'

export interface Comment {
  id: number
  userName: string
  message: string
  aiResponse?: string
  timestamp: number
}

interface Props {
  comments: Comment[]
}

export function CommentFeed({ comments }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        right: 12,
        width: 320,
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        {comments.map((c) => (
          <div
            key={c.id}
            style={{
              background: 'rgba(0, 0, 0, 0.55)',
              borderRadius: 8,
              padding: '6px 12px',
              marginBottom: 4,
              animation: 'fadeIn 0.3s ease-in',
            }}
          >
            <div style={{ fontSize: 13, color: '#ccc' }}>
              <span style={{ color: '#6cf', fontWeight: 'bold' }}>{c.userName}</span>
              <span style={{ marginLeft: 6 }}>{c.message}</span>
            </div>
            {c.aiResponse && (
              <div style={{ fontSize: 12, color: '#9d9', marginTop: 2 }}>
                → {c.aiResponse}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
