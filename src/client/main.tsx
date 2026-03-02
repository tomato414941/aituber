import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { ObsView } from './components/ObsView.js'
import './styles/index.css'

const MODEL_PATH = '/models/hiyori/Hiyori.model3.json'
const isStreamRoute = window.location.pathname === '/stream'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStreamRoute ? <ObsView modelPath={MODEL_PATH} /> : <App />}
  </StrictMode>,
)
