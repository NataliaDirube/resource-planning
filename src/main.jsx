import React from 'react'
import ReactDOM from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication } from '@azure/msal-browser'
import { msalConfig } from './authConfig'
import App from './App'

const msalInstance = new PublicClientApplication(msalConfig)

msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise().then(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    )
  })
})