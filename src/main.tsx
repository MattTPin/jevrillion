import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/space-grotesk'
import './styles/globals.css'
import App from './app/App.tsx'
import { takeOAuthCallback } from './features/keys/oauth.ts'

// Remove credentials left by older versions, which used sessionStorage.
try {
  sessionStorage.removeItem('jevrillion.keys.v1')
} catch {
  /* Storage may be disabled. */
}
const oauthCallback = takeOAuthCallback(window.location, window.history)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App oauthCallback={oauthCallback} />
  </StrictMode>,
)
