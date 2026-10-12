import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

declare global {
  interface Window {
    cricAppInstallPrompt?: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault()
  window.cricAppInstallPrompt = event as Window["cricAppInstallPrompt"]
  window.dispatchEvent(new Event("cricapp-install-ready"))
})

if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"))
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
