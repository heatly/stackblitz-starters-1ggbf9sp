# Quick Reference Guide

Fast lookup for common tasks and code patterns.

---

## Setup & Installation

### Quick Start (Copy & Paste)
```bash
# Clone
git clone https://github.com/yourusername/lazorkit-integration-examples
cd examples/1-passkey-login

# Install
pnpm install

# Configure
cp .env.example .env.local

# Run
pnpm dev
# Visit http://localhost:3000
```

### Environment Setup
```bash
# .env.local
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PAYMASTER_URL=https://paymaster.dev.solana.com/v1
NEXT_PUBLIC_USDC_MINT=EPjFWaLb3odccjf2cj6ipYKeS78Gb6piFmqgWXb462o9
```

---

## Common Code Patterns

### 1. Connect Wallet with Passkey
```typescript
import { useWallet } from "@lazor-kit/react";

export function MyComponent() {
  const { wallet, connect, disconnect, isConnecting } = useWallet();

  const handleConnect = async () => {
    await connect({
      feeMode: "paymaster",        // Enable gasless
      userVerification: "preferred", // Require biometric
    });
  };

  if (wallet?.address) {
    return <div>Connected: {wallet.address}</div>;
  }

  return (
    <button onClick={handleConnect} disabled={isConnecting}>
      {isConnecting ? "Connecting..." : "Connect"}
    </button>
  );
}
```

### 2. Send Gasless USDC
```typescript
import { buildUsdcTransfer } from "@/lib/transactions";
import { submitToPaymaster } from "@/lib/paymaster";
import { useWallet } from "@lazor-kit/react";
import { PublicKey } from "@solana/web3.js";

export function SendUSDC() {
  const { wallet, signTransaction } = useWallet();

  const handleSend = async (recipientAddress: string, amount: number) => {
    try {
      // 1. Build transaction
      const tx = await buildUsdcTransfer({
        senderAddress: new PublicKey(wallet.address),
        recipientAddress: new PublicKey(recipientAddress),
        amountUsdc: amount,
      });

      // 2. Sign with passkey (biometric prompt)
      const signed = await signTransaction(tx);

      // 3. Submit to paymaster (gas sponsored)
      const result = await submitToPaymaster(signed);

      if (result.success) {
        console.log("✅ Sent:", result.transactionSignature);
      } else {
        console.error("❌ Failed:", result.error);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <button onClick={() => handleSend("11111...", 5)}>
      Send 5 USDC
    </button>
  );
}
```

### 3. Validate User Input
```typescript
import {
  isValidSolanaAddress,
  hasUsdcBalance,
  parseTransactionError,
} from "@/lib/transactions";
import { PublicKey } from "@solana/web3.js";

// Check address format
if (!isValidSolanaAddress(userInput)) {
  setError("Invalid address");
  return;
}

// Check balance
const hasFunds = await hasUsdcBalance(
  new PublicKey(userWallet),
  5 // amount in USDC
);

if (!hasFunds) {
  setError("Insufficient balance");
  return;
}

// Parse error
try {
  // some operation
} catch (err) {
  const friendlyError = parseTransactionError(err);
  setError(friendlyError); // User-friendly message
}
```

### 4. Handle Errors
```typescript
const sendTransaction = async () => {
  try {
    // Your code here
  } catch (error) {
    // Check specific error types
    if (error instanceof Error) {
      if (error.message.includes("NotAllowedError")) {
        setError("You cancelled the operation");
      } else if (error.message.includes("InvalidStateError")) {
        setError("This passkey is already registered");
      } else {
        setError(error.message);
      }
    } else {
      setError("An unknown error occurred");
    }

    console.error("Full error:", error);
  }
};
```

### 5. Format Numbers
```typescript
import {
  lamportsToSol,
  baseUnitsToUsdc,
  usdcToBaseUnits,
} from "@/lib/config";

// Convert lamports to SOL
const solAmount = lamportsToSol(1_000_000_000); // 1 SOL

// Convert USDC base units to human-readable
const usdcAmount = baseUnitsToUsdc(5_000_000); // 5 USDC

// Convert human-readable USDC to base units
const baseUnits = usdcToBaseUnits(5); // 5,000,000
```

### 6. Fetch User Balance
```typescript
import { getUsdcBalance } from "@/lib/transactions";
import { PublicKey } from "@solana/web3.js";

const balance = await getUsdcBalance(new PublicKey(walletAddress));
console.log(`Balance: ${balance} USDC`);

// In React component with auto-refresh
useEffect(() => {
  const fetchBalance = async () => {
    const bal = await getUsdcBalance(new PublicKey(wallet.address));
    setBalance(bal);
  };

  fetchBalance();

  // Refresh every 10 seconds
  const interval = setInterval(fetchBalance, 10000);
  return () => clearInterval(interval);
}, [wallet?.address]);
```

---

## Common Errors & Fixes

### "Passkeys not supported"
```typescript
// Check support before showing UI
if (!window.PublicKeyCredential) {
  return <div>Passkeys not supported on your device</div>;
}
```

### "Insufficient balance"
```typescript
// Always check balance before sending
const hasFunds = await hasUsdcBalance(senderAddress, amountUSDC);
if (!hasFunds) {
  throw new Error("Insufficient USDC balance");
}
```

### "Invalid address"
```typescript
// Validate before sending
if (!isValidSolanaAddress(recipientAddress)) {
  throw new Error("Invalid recipient address");
}
```

### "Paymaster rejected"
```typescript
// Check paymaster health first
const { isHealthy } = await checkPaymasterStatus();
if (!isHealthy) {
  console.warn("Paymaster down, fallback to user-pays");
  // Can fallback to non-paymaster transaction
}
```

### Transaction timeout
```typescript
// Add retry logic
for (let i = 0; i < 3; i++) {
  try {
    return await submitToPaymaster(tx);
  } catch (error) {
    if (i === 2) throw error; // Last attempt
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
  }
}
```

---

## File Locations

```
examples/1-passkey-login/
├── lib/
│   ├── config.ts           ← Constants & config
│   ├── transactions.ts     ← TX building & validation
│   └── paymaster.ts        ← Paymaster integration
│
├── components/
│   ├── WalletConnect.tsx   ← Passkey auth UI
│   └── SendUSDC.tsx        ← Transfer UI
│
├── app/
│   ├── layout.tsx          ← Root layout
│   └── page.tsx            ← Main page
│
├── .env.example            ← Copy to .env.local
├── package.json            ← Dependencies
└── README.md               ← Instructions
```

---

## Key Imports

```typescript
// Lazorkit SDK
import { useWallet } from "@lazor-kit/react";

// Solana Web3
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

// SPL Token (for USDC)
import { createTransferInstruction } from "@solana/spl-token";

// Our utilities
import { buildUsdcTransfer } from "@/lib/transactions";
import { submitToPaymaster } from "@/lib/paymaster";
import { USDC_MINT, RPC_URL } from "@/lib/config";

// React
import { useState, useEffect } from "react";
```

---

## Deployment

### Deploy to Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Then redeploy
vercel --prod
```

### Deploy to Other Services
```bash
# Build for production
pnpm build
pnpm start

# Docker example
docker build -t lazorkit-example .
docker run -p 3000:3000 lazorkit-example
```

### Switch to Mainnet
```bash
# Update .env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_PAYMASTER_URL=https://paymaster.yourcompany.com
```

---

## Testing Checklist

Quick test before deployment:

```bash
# ✓ Connect with Face ID
# ✓ Connect with Fingerprint
# ✓ See wallet address
# ✓ Refresh → still connected
# ✓ Enter recipient address (valid)
# ✓ Enter amount (5 USDC)
# ✓ Click Send
# ✓ Complete biometric
# ✓ Transaction confirms (15-30s)
# ✓ View on Solscan
# ✓ Recipient received USDC
# ✓ You didn't pay gas fees! 💰
```

---

## Documentation Links

**Official:**
- Lazorkit Docs: https://docs.lazorkit.com
- Lazorkit GitHub: https://github.com/lazor-kit/lazor-kit
- Solana Docs: https://docs.solana.com

**Tutorials:**
- Helius Passkeys: https://www.helius.dev/blog/solana-passkeys
- WebAuthn: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API

**Community:**
- Lazorkit Telegram: https://t.me/lazorkit
- Solana Discord: https://discord.gg/solana

---

## Copy-Paste Config

### For Devnet (Testing)
```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PAYMASTER_URL=https://paymaster.dev.solana.com/v1
NEXT_PUBLIC_USDC_MINT=EPjFWaLb3odccjf2cj6ipYKeS78Gb6piFmqgWXb462o9
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
```

### For Mainnet (Production)
```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_PAYMASTER_URL=https://paymaster.mainnet.solana.com/v1
NEXT_PUBLIC_USDC_MINT=EPjFWaLb3odccjf2cj6ipYKeS78Gb6piFmqgWXb462o9
NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta
```

---

## Next Steps

1. **Setup:** Follow Quick Start above
2. **Learn:** Read TUTORIALS.md (3 detailed tutorials)
3. **Understand:** Read ARCHITECTURE.md (how it works)
4. **Extend:** Add more features (token swaps, batch transfers, etc.)
5. **Deploy:** Deploy to Vercel
6. **Share:** Write blog post or X thread
7. **Submit:** Submit to bounty program

---

**Happy building! 🚀**

*Questions? Check TUTORIALS.md for detailed walkthroughs or ARCHITECTURE.md for technical deep-dives.*
