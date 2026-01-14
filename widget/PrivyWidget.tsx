import { useEffect, useCallback, useRef } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import type { WalletInfo, PrivyWidgetAPI, EvmSigners, SolanaSigners, PrivyWidgetConfig } from './types'

const LAST_LOGIN_KEY = 'privy-last-login-type'

// Global promise for ready state (resolves once)
let readyResolve: ((api: PrivyWidgetAPI) => void) | null = null
let readyPromise: Promise<PrivyWidgetAPI> | null = null
let hasDispatchedReady = false

function getOrCreateReadyPromise(): Promise<PrivyWidgetAPI> {
  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      readyResolve = resolve
    })
    ;(window as any).PrivyWidgetReady = readyPromise
  }
  return readyPromise
}

// Initialize promise immediately
getOrCreateReadyPromise()

interface PrivyWidgetProps {
  config?: PrivyWidgetConfig
}

export function PrivyWidget({ config }: PrivyWidgetProps) {
  const { ready, authenticated, login, logout, exportWallet } = usePrivy()
  const { wallets } = useWallets()
  const authCallbacksRef = useRef<Set<(auth: boolean) => void>>(new Set())
  const onReadyCallbacksRef = useRef<Set<(api: PrivyWidgetAPI) => void>>(new Set())
  const walletsRef = useRef(wallets)
  const hasCheckedLastLogin = useRef(false)
  walletsRef.current = wallets  // Always keep ref updated

  // lastLoginOnly: Check if current login matches last saved method
  useEffect(() => {
    if (!config?.lastLoginOnly) return
    if (!ready || !authenticated || wallets.length === 0) return
    if (hasCheckedLastLogin.current) return

    hasCheckedLastLogin.current = true

    const lastType = localStorage.getItem(LAST_LOGIN_KEY)
    const currentType = wallets[0]?.walletClientType

    // If we have a saved type and current doesn't match, logout
    if (lastType && currentType && lastType !== currentType) {
      console.log(`[Privy] Last login was ${lastType}, but got ${currentType}. Logging out.`)
      logout()
      return
    }

    // Save current type for future
    if (currentType) {
      localStorage.setItem(LAST_LOGIN_KEY, currentType)
    }
  }, [ready, authenticated, wallets, config?.lastLoginOnly, logout])

  // Save login type on successful auth (when not using lastLoginOnly check)
  useEffect(() => {
    if (config?.lastLoginOnly) return // Already handled above
    if (!authenticated || wallets.length === 0) return

    const currentType = wallets[0]?.walletClientType
    if (currentType) {
      localStorage.setItem(LAST_LOGIN_KEY, currentType)
    }
  }, [authenticated, wallets, config?.lastLoginOnly])

  // Get active wallet (prefer embedded Privy wallet for secp256k1 signing)
  // Uses ref to always get current wallets, avoiding stale closure issues
  const getActiveWallet = useCallback((): WalletInfo | null => {
    const currentWallets = walletsRef.current
    if (!currentWallets.length) return null
    // Prefer embedded Privy wallet (needed for secp256k1_sign / Antelope)
    const embedded = currentWallets.find(w => w.walletClientType === 'privy')
    const active = embedded || currentWallets[0]
    return {
      address: active.address,
      chainType: 'ethereum',
      walletClientType: active.walletClientType
    }
  }, [])  // No dependencies - uses ref

  // Get EVM wallet (prefer embedded for secp256k1 signing)
  const getEvmWallet = useCallback(() => {
    const currentWallets = walletsRef.current
    // Prefer embedded Privy wallet (needed for secp256k1_sign / Antelope)
    return currentWallets.find(w => w.walletClientType === 'privy') || currentWallets[0] || null
  }, [])  // No dependencies - uses ref

  // EVM: Get address
  const evmGetAddress = useCallback((): string | null => {
    const wallet = getEvmWallet()
    return wallet?.address || null
  }, [getEvmWallet])

  // EVM: Get provider (for raw RPC calls)
  const evmGetProvider = useCallback(async (): Promise<any> => {
    const wallet = getEvmWallet()
    if (!wallet) throw new Error('No EVM wallet available')
    return await wallet.getEthereumProvider()
  }, [getEvmWallet])

  // EVM: Sign message (EIP-191 personal_sign)
  const evmSignMessage = useCallback(async (message: string): Promise<string> => {
    const wallet = getEvmWallet()
    if (!wallet) throw new Error('No EVM wallet available')
    const provider = await wallet.getEthereumProvider()
    const signature = await provider.request({
      method: 'personal_sign',
      params: [message, wallet.address]
    })
    return signature as string
  }, [getEvmWallet])

  // EVM: Sign typed data (EIP-712 eth_signTypedData_v4)
  const evmSignTypedData = useCallback(async (typedData: unknown): Promise<string> => {
    const wallet = getEvmWallet()
    if (!wallet) throw new Error('No EVM wallet available')
    const provider = await wallet.getEthereumProvider()
    const signature = await provider.request({
      method: 'eth_signTypedData_v4',
      params: [wallet.address, typeof typedData === 'string' ? typedData : JSON.stringify(typedData)]
    })
    return signature as string
  }, [getEvmWallet])

  // EVM: Get current chainId
  const evmGetChainId = useCallback(async (): Promise<number | null> => {
    const wallet = getEvmWallet()
    if (!wallet) return null
    const provider = await wallet.getEthereumProvider()
    const chainId = await provider.request({ method: 'eth_chainId' })
    return parseInt(chainId as string, 16)
  }, [getEvmWallet])

  // EVM: Switch chain
  const evmSwitchChain = useCallback(async (chainId: number): Promise<boolean> => {
    const wallet = getEvmWallet()
    if (!wallet) return false
    const provider = await wallet.getEthereumProvider()
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }]
      })
      return true
    } catch (error: any) {
      // Chain not added, try to add it (for Arbitrum)
      if (error.code === 4902 && chainId === 42161) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xa4b1',
              chainName: 'Arbitrum One',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://arb1.arbitrum.io/rpc'],
              blockExplorerUrls: ['https://arbiscan.io']
            }]
          })
          return true
        } catch {
          return false
        }
      }
      return false
    }
  }, [getEvmWallet])

  // EVM: Raw secp256k1 signature (Privy embedded wallet only!)
  // This signs a raw 32-byte hash WITHOUT any Ethereum prefix
  // Perfect for EOSIO/Antelope signatures
  const evmSecp256k1Sign = useCallback(async (hash: string): Promise<string> => {
    const wallet = getEvmWallet()
    if (!wallet) throw new Error('No EVM wallet available')

    // This only works with Privy embedded wallets
    if (wallet.walletClientType !== 'privy') {
      throw new Error('secp256k1_sign only works with Privy embedded wallets, not external wallets like MetaMask')
    }

    const provider = await wallet.getEthereumProvider()
    const signature = await provider.request({
      method: 'secp256k1_sign',
      params: [hash]
    })
    return signature as string
  }, [getEvmWallet])

  // Solana: Placeholder for future implementation
  const solanaGetAddress = useCallback((): string | null => {
    console.warn('Solana wallets not yet implemented')
    return null
  }, [])

  const solanaSignMessage = useCallback(async (_message: string): Promise<string> => {
    throw new Error('Solana wallets not yet implemented')
  }, [])

  // Expose API to window
  useEffect(() => {
    const evm: EvmSigners = {
      getAddress: evmGetAddress,
      signMessage: evmSignMessage,
      signTypedData: evmSignTypedData,
      getChainId: evmGetChainId,
      switchChain: evmSwitchChain,
      getProvider: evmGetProvider,
      secp256k1Sign: evmSecp256k1Sign
    }

    const solana: SolanaSigners = {
      getAddress: solanaGetAddress,
      signMessage: solanaSignMessage
    }

    const api: PrivyWidgetAPI = {
      ready: () => ready,
      login: async () => { login() },
      logout: async () => { await logout() },
      exportWallet: async () => { await exportWallet() },
      getActiveWallet,
      onAuthChange: (callback) => {
        authCallbacksRef.current.add(callback)
        // Immediate call with current state
        callback(authenticated)
        return () => {
          authCallbacksRef.current.delete(callback)
        }
      },
      // onReady: immediate-call semantics - if ready, call immediately
      onReady: (callback) => {
        if (ready) {
          callback(api)
        } else {
          onReadyCallbacksRef.current.add(callback)
        }
        return () => {
          onReadyCallbacksRef.current.delete(callback)
        }
      },
      evm,
      solana
    }
    window.PrivyWidget = api

    // Resolve promise and dispatch event only ONCE when ready
    if (ready && !hasDispatchedReady) {
      hasDispatchedReady = true

      // Resolve the global promise
      if (readyResolve) {
        readyResolve(api)
        readyResolve = null
      }

      // Call all onReady callbacks
      onReadyCallbacksRef.current.forEach(cb => cb(api))
      onReadyCallbacksRef.current.clear()

      // Dispatch legacy event (for backwards compat)
      window.dispatchEvent(new CustomEvent('privy-ready'))
    }

    return () => {
      delete window.PrivyWidget
    }
  }, [ready, authenticated, getActiveWallet, evmGetAddress, evmSignMessage, evmSignTypedData, evmGetChainId, evmSwitchChain, evmGetProvider, evmSecp256k1Sign, solanaGetAddress, solanaSignMessage, login, logout, exportWallet])

  // Notify auth changes AND wallet changes (wallets load async after auth)
  useEffect(() => {
    authCallbacksRef.current.forEach(cb => cb(authenticated))
  }, [authenticated, wallets])

  // No UI - only expose API, Privy modal is handled internally
  return null
}
