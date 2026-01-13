import { StrictMode } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import { PrivyWidget } from './PrivyWidget'
import './types' // Import global type augmentation
import './styles.css' // Import custom styles

let root: Root | null = null

function mount(elementId = 'privy-root') {
  const container = document.getElementById(elementId)
  if (!container) {
    console.error(`[Privy Island] Mount point #${elementId} not found`)
    return
  }

  const appId = window.__PRIVY_APP_ID__
  if (!appId) {
    console.error('[Privy Island] PRIVY_APP_ID not set. Set window.__PRIVY_APP_ID__ before loading.')
    return
  }

  root = createRoot(container)
  root.render(
    <StrictMode>
      <PrivyProvider
        appId={appId}
        config={{
          appearance: {
            theme: '#161818', // Our dark background
            landingHeader: 'Connect to Alcor Perps',
            loginMessage: 'Connect your wallet to start trading',
            showWalletLoginFirst: false,
            walletChainType: 'ethereum-only',
            walletList: ['detected_wallets', 'metamask', 'wallet_connect', 'coinbase_wallet']
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: 'all-users'  // Create embedded wallet for all users (including social login)
            }
          }
        }}
      >
        <PrivyWidget />
      </PrivyProvider>
    </StrictMode>
  )
}

function unmount() {
  if (root) {
    root.unmount()
    root = null
  }
}

// Auto-mount when DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mount())
  } else {
    // DOM already loaded, mount immediately
    mount()
  }
}

// Export for manual control if needed
export { mount, unmount }
