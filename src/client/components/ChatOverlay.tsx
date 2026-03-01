interface Props {
  userName: string
  userMessage: string
  aiResponse: string
}

export function ChatOverlay({ userName, userMessage, aiResponse }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '80%',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 14,
          color: '#aaa',
        }}
      >
        <span style={{ color: '#6cf', fontWeight: 'bold' }}>{userName}</span>: {userMessage}
      </div>
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          borderRadius: 12,
          padding: '12px 20px',
          fontSize: 20,
          color: '#fff',
          lineHeight: 1.5,
        }}
      >
        {aiResponse}
      </div>
    </div>
  )
}
