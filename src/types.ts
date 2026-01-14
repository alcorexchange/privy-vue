export interface WalletInfo {
  address: string
  chainType: 'ethereum' | 'solana'
  walletClientType: string  // 'privy' for embedded, 'metamask', 'phantom' etc
}

export interface EvmSigners {
  /** EIP-191 personal_sign */
  signMessage: (message: string) => Promise<string>
  /** EIP-712 eth_signTypedData_v4 */
  signTypedData: (typedData: unknown) => Promise<string>
  /** Get EVM wallet address */
  getAddress: () => string | null
  /** Get current chainId */
  getChainId: () => Promise<number | null>
  /** Switch to a specific chain */
  switchChain: (chainId: number) => Promise<boolean>
  /** Get raw Ethereum provider for custom RPC calls */
  getProvider: () => Promise<any>
  /**
   * Raw secp256k1 ECDSA signature (Privy embedded wallet ONLY!)
   * Signs a 32-byte hash WITHOUT any Ethereum prefix.
   * Perfect for EOSIO/Antelope signatures.
   * @param hash - 32-byte hex hash starting with 0x
   * @returns hex signature (r + s + v)
   */
  secp256k1Sign: (hash: string) => Promise<string>
}

export interface SolanaSigners {
  /** Sign message with Solana wallet */
  signMessage: (message: string) => Promise<string>
  /** Get Solana wallet address */
  getAddress: () => string | null
}

export interface PrivyWidgetAPI {
  ready: () => boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  getActiveWallet: () => WalletInfo | null
  /** Subscribe to auth changes. Calls immediately with current state. Returns unsubscribe. */
  onAuthChange: (callback: (isAuthenticated: boolean) => void) => () => void
  /** Subscribe to ready state. If already ready, calls immediately. Returns unsubscribe. */
  onReady: (callback: (api: PrivyWidgetAPI) => void) => () => void
  /**
   * Export embedded wallet private key.
   * Opens Privy's secure modal where user can see/copy their private key.
   * Only works with Privy embedded wallets, not external wallets.
   */
  exportWallet: () => Promise<void>

  /** EVM chain signing methods */
  evm: EvmSigners

  /** Solana chain signing methods (placeholder for future) */
  solana: SolanaSigners
}

export interface PrivyWidgetConfig {
  /** Modal header text */
  landingHeader?: string
  /** Modal login message */
  loginMessage?: string
  /** Disable external wallets (Metamask, Phantom, etc). Only social login + embedded wallet */
  externalWallets?: boolean
  /** Only auto-login with the last used method. Prevents injected wallets from hijacking social login */
  lastLoginOnly?: boolean
}

export interface UsePrivyWidgetOptions {
  /** Privy App ID */
  appId: string
  /** Widget appearance config */
  config?: PrivyWidgetConfig
  /** URL to the IIFE bundle (default: auto-resolved from package) */
  scriptUrl?: string
  /** Container element ID for React mount (default: 'privy-widget-root') */
  containerId?: string
  /** Auto-inject container into DOM (default: true) */
  autoInjectContainer?: boolean
}

declare global {
  interface Window {
    PrivyWidget?: PrivyWidgetAPI
    PrivyWidgetReady?: Promise<PrivyWidgetAPI>
    __PRIVY_APP_ID__?: string
    __PRIVY_CONFIG__?: PrivyWidgetConfig
  }
}
