import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch'

// Required by pixi-live2d-display
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).PIXI = PIXI

interface Props {
  modelPath: string
  width: number
  height: number
  onModelReady?: (model: Live2DModel) => void
}

export function Live2DCanvas({ modelPath, width, height, onModelReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const app = new PIXI.Application({
      view: canvasRef.current,
      width,
      height,
      backgroundAlpha: 0,
      autoStart: true,
    })

    let destroyed = false

    Live2DModel.from(modelPath, {
      ticker: PIXI.Ticker.shared,
    }).then((model) => {
      if (destroyed) return

      const scale = Math.min(width / model.width, height / model.height) * 0.8
      model.scale.set(scale)
      model.x = (width - model.width * scale) / 2
      model.y = (height - model.height * scale) / 2

      app.stage.addChild(model)
      onModelReady?.(model)
    })

    return () => {
      destroyed = true
      app.destroy(true)
    }
  }, [modelPath, width, height, onModelReady])

  return <canvas ref={canvasRef} style={{ display: 'block' }} />
}
