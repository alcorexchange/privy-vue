# @alcorexchange/privy-vue

Privy wallet integration for Vue.js with EVM and Antelope/EOS signing support.

## Installation

```bash
yarn add @alcorexchange/privy-vue
```

## Setup

### 1. Load the widget script

Add to your HTML or create a Nuxt plugin:

```typescript
// plugins/privy.client.ts
export default defineNuxtPlugin(() => {
  window.__PRIVY_APP_ID__ = 'your-privy-app-id'

  // Optional: configure appearance and behavior
  window.__PRIVY_CONFIG__ = {
    landingHeader: 'Connect Wallet',
    loginMessage: 'Connect your wallet to continue',
    externalWallets: true,   // Set false to disable external wallets (Metamask, etc)
    lastLoginOnly: true      // Only auto-login with last used method
  }

  const script = document.createElement('script')
  script.src = '/privy-island.iife.js' // Copy from node_modules/@alcorexchange/privy-vue/dist/
  document.head.appendChild(script)
})
```

### 2. Use the composable

```vue
<script setup lang="ts">
import { usePrivyWidget } from '@alcorexchange/privy-vue'

const {
  isReady,
  isConnected,
  address,
  walletType,
  isEmbeddedWallet,
  login,
  logout,
  exportWallet,
  evm
} = usePrivyWidget()
</script>

<template>
  <div v-if="!isReady">Loading...</div>
  <div v-else-if="!isConnected">
    <button @click="login">Connect</button>
  </div>
  <div v-else>
    <p>Address: {{ address }}</p>
    <button @click="logout">Disconnect</button>
  </div>
</template>
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `landingHeader` | string | `'Connect Wallet'` | Modal header text |
| `loginMessage` | string | `'Connect your wallet to continue'` | Modal login message |
| `externalWallets` | boolean | `true` | Enable external wallets (Metamask, Phantom, etc). Set `false` for social login only |
| `lastLoginOnly` | boolean | `false` | Only auto-login with the last used method. Prevents injected wallets from hijacking social login sessions |

## EVM Signing

```typescript
// Sign message (EIP-191)
const signature = await evm.signMessage('Hello World')

// Sign typed data (EIP-712)
const sig = await evm.signTypedData(typedData)

// Raw secp256k1 signature (Privy embedded wallet only)
// Perfect for Antelope/EOS signatures
const rawSig = await evm.secp256k1Sign(hash)
```

## Antelope/EOS Signing

The `secp256k1Sign` method provides raw ECDSA signatures without Ethereum prefix, making it perfect for signing Antelope/EOS transactions:

```typescript
import { Signature } from '@wharfkit/antelope'

// Hash your transaction digest
const digest = '...' // 32-byte hex hash

// Sign with Privy embedded wallet
const sig = await evm.secp256k1Sign(digest)

// Convert to Antelope signature format
const anteSig = Signature.from({ r, s, recid })
```

## License

MIT
