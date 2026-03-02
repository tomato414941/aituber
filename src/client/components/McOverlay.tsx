import type { McGameState } from '../../shared/types.js'

interface Props {
  state: McGameState
}

export function McOverlay({ state }: Props) {
  const hpPercent = (state.health / 20) * 100
  const foodPercent = (state.food / 20) * 100
  const hpColor = state.health <= 6 ? '#f44' : state.health <= 12 ? '#fa0' : '#4f4'
  const foodColor = state.food <= 6 ? '#f44' : '#fa0'

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
        fontSize: 13,
        color: '#fff',
        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
      }}
    >
      {/* HP bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>HP</span>
        <div style={{ width: 120, height: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 4 }}>
          <div
            style={{
              width: `${hpPercent}%`,
              height: '100%',
              background: hpColor,
              borderRadius: 4,
              transition: 'width 0.3s',
            }}
          />
        </div>
        <span>{state.health}/20</span>
      </div>

      {/* Food bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>Food</span>
        <div style={{ width: 120, height: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 4 }}>
          <div
            style={{
              width: `${foodPercent}%`,
              height: '100%',
              background: foodColor,
              borderRadius: 4,
              transition: 'width 0.3s',
            }}
          />
        </div>
        <span>{state.food}/20</span>
      </div>

      {/* Position & time */}
      <div style={{ fontSize: 11, color: '#ccc' }}>
        ({state.position.x}, {state.position.y}, {state.position.z}) |{' '}
        {state.time.isDay ? 'Day' : 'Night'} |{' '}
        {state.isRaining ? 'Rain' : 'Clear'}
      </div>

      {/* Inventory (top 6 items) */}
      {state.inventory.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            maxWidth: 280,
            marginTop: 2,
          }}
        >
          {state.inventory.slice(0, 6).map((item) => (
            <div
              key={item.name}
              style={{
                background: 'rgba(0,0,0,0.5)',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 11,
              }}
            >
              {item.name} x{item.count}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
