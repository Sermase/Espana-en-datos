import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import './portada.css'
import Portada from './Portada'
import '../tactil.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Portada />
    </MotionConfig>
  </StrictMode>,
)
