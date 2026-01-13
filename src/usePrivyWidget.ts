import { ref, shallowRef, readonly, onMounted, onUnmounted, computed } from 'vue'
import type { PrivyWidgetAPI, WalletInfo, UsePrivyWidgetOptions, EvmSigners, SolanaSigners } from './types'

// Singleton state - shared across all usePrivyWidget calls
const globalApi = shallowRef<PrivyWidgetAPI | null>(null)
const globalIsReady = ref(false)
const globalIsConnected = ref(false)
const globalWallet = shallowRef<WalletInfo | null>(null)
let initialized = false

/**
 * Vue composable for Privy wallet integration.
 * Provides reactive state and full API access for wallet operations.
 *
 * NOTE: Requires privy-island.client.ts plugin to load the IIFE script.
 *
 * @example
 * ```vue
 * <script setup>
 * import { usePrivyWidget } from '@alcorexchange/privy-vue'
 *
 * const { isReady, isConnected, address, login, logout, evm } = usePrivyWidget({
 *   appId: 'your-privy-app-id'
 * })
 *
 * // Sign a message
 * const signature = await evm.signMessage('Hello World')
 * </script>
 * ```
 */
export function usePrivyWidget(_options?: UsePrivyWidgetOptions) {
  // Local refs that sync with global state
  const isReady = computed(() => globalIsReady.value)
  const isConnected = computed(() => globalIsConnected.value)
  const wallet = computed(() => globalWallet.value)
  const address = computed(() => globalWallet.value?.address ?? null)
  const walletType = computed(() => globalWallet.value?.walletClientType ?? null)
  const isEmbeddedWallet = computed(() => globalWallet.value?.walletClientType === 'privy')

  let unsubscribeAuth: (() => void) | null = null

  // Initialize widget (wait for script loaded by plugin)
  const init = async () => {
    if (typeof window === 'undefined') return
    if (initialized && globalApi.value) return

    // Wait for PrivyWidgetReady promise to exist (script must load first)
    let attempts = 0
    while (!window.PrivyWidgetReady && attempts < 100) {
      await new Promise(resolve => setTimeout(resolve, 50))
      attempts++
    }

    if (!window.PrivyWidgetReady) {
      console.error('[privy-vue] PrivyWidgetReady promise not found. Is privy-island script loaded?')
      return
    }

    // Wait for widget to be ready
    const api = await window.PrivyWidgetReady
    if (!api) return

    initialized = true
    globalApi.value = api
    globalIsReady.value = true

    // Subscribe to auth changes
    unsubscribeAuth = api.onAuthChange((authenticated) => {
      globalIsConnected.value = authenticated
      globalWallet.value = authenticated ? api.getActiveWallet() : null
    })
  }

  // Cleanup
  const cleanup = () => {
    if (unsubscribeAuth) {
      unsubscribeAuth()
      unsubscribeAuth = null
    }
  }

  // Lifecycle
  onMounted(() => {
    init()
  })

  onUnmounted(() => {
    cleanup()
  })

  // API proxy methods
  const login = async (): Promise<void> => {
    if (!globalApi.value) throw new Error('Privy widget not ready')
    await globalApi.value.login()
  }

  const logout = async (): Promise<void> => {
    if (!globalApi.value) throw new Error('Privy widget not ready')
    await globalApi.value.logout()
  }

  const exportWallet = async (): Promise<void> => {
    if (!globalApi.value) throw new Error('Privy widget not ready')
    await globalApi.value.exportWallet()
  }

  const getActiveWallet = (): WalletInfo | null => {
    return globalApi.value?.getActiveWallet() ?? null
  }

  // EVM methods proxy
  const evm: EvmSigners = {
    getAddress: () => globalApi.value?.evm.getAddress() ?? null,
    signMessage: async (message: string) => {
      if (!globalApi.value) throw new Error('Privy widget not ready')
      return globalApi.value.evm.signMessage(message)
    },
    signTypedData: async (typedData: unknown) => {
      if (!globalApi.value) throw new Error('Privy widget not ready')
      return globalApi.value.evm.signTypedData(typedData)
    },
    getChainId: async () => {
      if (!globalApi.value) throw new Error('Privy widget not ready')
      return globalApi.value.evm.getChainId()
    },
    switchChain: async (chainId: number) => {
      if (!globalApi.value) throw new Error('Privy widget not ready')
      return globalApi.value.evm.switchChain(chainId)
    },
    getProvider: async () => {
      if (!globalApi.value) throw new Error('Privy widget not ready')
      return globalApi.value.evm.getProvider()
    },
    secp256k1Sign: async (hash: string) => {
      if (!globalApi.value) throw new Error('Privy widget not ready')
      return globalApi.value.evm.secp256k1Sign(hash)
    }
  }

  // Solana methods proxy
  const solana: SolanaSigners = {
    getAddress: () => globalApi.value?.solana.getAddress() ?? null,
    signMessage: async (message: string) => {
      if (!globalApi.value) throw new Error('Privy widget not ready')
      return globalApi.value.solana.signMessage(message)
    }
  }

  // Event subscription helpers
  const onReady = (callback: (api: PrivyWidgetAPI) => void): (() => void) => {
    if (globalApi.value) {
      callback(globalApi.value)
      return () => {}
    }
    return globalApi.value?.onReady(callback) ?? (() => {})
  }

  const onAuthChange = (callback: (isAuthenticated: boolean) => void): (() => void) => {
    if (!globalApi.value) {
      // Queue for when ready
      const unsubReady = onReady((api) => {
        api.onAuthChange(callback)
      })
      return unsubReady
    }
    return globalApi.value.onAuthChange(callback)
  }

  return {
    // Reactive state
    isReady: readonly(isReady),
    isConnected: readonly(isConnected),
    wallet: readonly(wallet),
    address: readonly(address),
    walletType: readonly(walletType),
    isEmbeddedWallet: readonly(isEmbeddedWallet),

    // Raw API access
    api: readonly(globalApi),

    // Auth methods
    login,
    logout,
    exportWallet,
    getActiveWallet,

    // Chain-specific signers
    evm,
    solana,

    // Event subscriptions
    onReady,
    onAuthChange
  }
}
