// Typefaces are bundled, not fetched: the interface has to look the same on a laboratory machine
// with no internet connection as it does here. Inter for labels and prose, JetBrains Mono for every
// technical number, so a mass, an interval or an error is never mistaken for prose.
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
