# Lazorkit Integration Tutorials

Complete step-by-step guides for integrating Lazorkit SDK into your Solana dApp.

---

## Tutorial 1: Create Your First Passkey & Connect Wallet (5 min)

### What You'll Learn
- How to create a passkey on your device
- How Lazorkit derives a Solana wallet from your passkey
- How sessions persist across page refreshes

### Prerequisites
- ✅ Modern browser (Chrome, Firefox, Safari, Edge)
- ✅ Device with biometric support (or security key)
- ✅ Example app running locally

### Step-by-Step Guide

#### Step 1: Start the Application
```bash
cd examples/1-passkey-login
pnpm dev
```
Visit `http://localhost:3000` in your browser.

#### Step 2: Understand the UI
You'll see three main sections:
1. **Connect Button** - "🔐 Connect with Passkey"
2. **Info Box** - Explains what passkeys are
3. **System Check** - Shows if your device supports passkeys

**Code Behind the UI** (`components/WalletConnect.tsx`):
```typescript
// This is what happens when you click "Connect with Passkey"
const handleConnect = async () => {
  // Step 1: Check browser supports WebAuthn
  if (!window.PublicKeyCredential) {
    setError("Passkeys not supported");
    return;
  }

  // Step 2: Call Lazorkit to initiate passkey creation
  await connect({
    feeMode: "paymaster",        // Enable gasless transactions
    userVerification: "preferred", // Require biometric/PIN
    attestation: "none",          // Security level
  });
};
```

#### Step 3: Click "Connect with Passkey"
When you click the button:
1. Browser opens a native dialog
2. Choose biometric method:
   - **Windows Hello** (Windows)
   - **Face ID** (macOS, iOS)
   - **Fingerprint** (Android)
   - **Security Key** (YubiKey, etc.)
3. Complete biometric verification

#### Step 4: Behind the Scenes - What Lazorkit Does
```
┌─────────────────────────────────────────────────┐
│ 1. Browser creates cryptographic key pair       │
│    • Private key: Stored securely on device     │
│    • Public key: Sent to your app               │
│                                                  │
│ 2. Lazorkit derives Solana wallet from key      │
│    • Uses key material for seed derivation      │
│    • Generates deterministic wallet address     │
│    • Same passkey = Same wallet address         │
│                                                  │
│ 3. Wallet stored in localStorage               │
│    • Allows fast login on refresh               │
│    • Encrypted credential reference             │
│                                                  │
│ 4. Session persisted                            │
│    • User stays logged in for 24 hours          │
│    • Can close tab and come back                │
└─────────────────────────────────────────────────┘
```

#### Step 5: Verify Connection
After successful connection:
- UI changes to show **"Connected Wallet"**
- You'll see your wallet address (truncated)
- Example: `4mA7...jKz2`

**What this means:**
```typescript
// Your wallet info
wallet = {
  address: "4mA7Bi3NpJ8kZ9w1L4mQ5R6S7T8U9V0W1X2Y3Z4mA7...",
  publicKey: PublicKey(...),
  type: "passkey",
  // Ready to sign transactions!
}
```

#### Step 6: Refresh Page - Session Persists
Refresh the page (`Cmd+R` or `Ctrl+R`).

**Expected:** Wallet still connected without any action needed.

**Why:** Lazorkit stores the credential reference and session token.

```typescript
// On app load, Lazorkit automatically:
// 1. Checks localStorage for stored credential
// 2. Verifies credential is still valid
// 3. Re-derives wallet if found
// 4. User stays logged in
```

#### Step 7: Disconnect
Click **"Disconnect"** button to clear session.

**What happens:**
- Session removed from localStorage
- Credential reference cleared
- Next visit requires passkey auth again

---

### Key Concepts Explained

#### What's a Passkey?
```
Traditional Auth          Passkey Auth
┌──────────────┐        ┌──────────────┐
│ User: alice  │        │ Face ID      │
│ Pass: secret │        │ (encrypted)  │
└──────────────┘        └──────────────┘
❌ Easy to guess         ✅ Biometric only
❌ Reused across apps    ✅ Unique per service
```

#### Seed Phrases vs Passkeys
```
Seed Phrase (Old Way)
- 12-24 random words
- User must memorize or store safely
- If leaked, entire wallet compromised
- Not user-friendly

Passkeys (New Way)
- Biometric or security key
- Stored securely by OS
- Cannot be shared or guessed
- Natural, intuitive UX
```

#### How Solana Wallet is Derived
```
Your Biometric Input
       ↓
   WebAuthn
       ↓
  Passkey Credential
  (Private key sealed on device)
       ↓
  Lazorkit Derivation
  (Uses credential material)
       ↓
  Solana Key Pair
  (Deterministic from passkey)
       ↓
  Wallet Address
  (e.g., 4mA7Bi3NpJ8kZ9w1L4mQ5R6S7...)
```

---

### Troubleshooting

**"Your browser doesn't support passkeys"**
- Use Chrome, Firefox, Safari, or Edge
- Mobile: Safari on iOS, Chrome on Android

**"NotAllowedError: User cancelled the operation"**
- You pressed "Cancel" in the biometric dialog
- This is normal - try again and complete the auth

**"InvalidStateError: This passkey is already registered"**
- The passkey already exists on this device
- Use a different device or passkey for testing

**"Wallet not connected after refresh"**
- Clear browser cache and try again
- Check localStorage is enabled: Settings → Privacy → Storage

---

### Code Reference: WalletConnect Component

Location: `components/WalletConnect.tsx`

**Key Functions:**
```typescript
// 1. Initiate passkey creation
await connect({
  feeMode: "paymaster",
  userVerification: "preferred",
});

// 2. Access connected wallet
const { wallet } = useWallet();
console.log(wallet.address); // "4mA7Bi3NpJ8kZ9w1L4mQ5..."

// 3. Disconnect session
await disconnect();
```

**Configuration Options:**
```typescript
{
  feeMode: "paymaster" | "user",  // Who pays gas
  userVerification: "required" | "preferred" | "discouraged",
  attestation: "none" | "indirect" | "direct" | "enterprise",
  timeout: 60000, // milliseconds
}
```

---

---

## Tutorial 2: Send Gasless USDC Transaction (3 min)

### What You'll Learn
- Build a transaction without signing yet
- Sign transaction with passkey (automatic biometric)
- Send to paymaster which sponsors gas
- Verify transaction on Solscan

### Prerequisites
- ✅ Completed Tutorial 1 (wallet connected)
- ✅ Have USDC on Devnet (see setup section)
- ✅ Know a test recipient address

### Getting Test USDC

**Option 1: Use Solana CLI**
```bash
# Get devnet SOL first
solana airdrop 5 --network devnet

# Swap SOL to USDC using a DEX like Jupiter
# Or use a test token account if available
```

**Option 2: Use Web UI**
Visit https://solfaucet.com for SOL, then swap to USDC.

---

### Step-by-Step Guide

#### Step 1: Navigate to Send Tab
After connecting wallet, you'll see:
- **Balance Display**: "Your USDC Balance: 5.00 USDC"
- **Form**: Recipient, Amount, Memo fields
- **Fee Display**: "Transaction Fee: $0 (Sponsored)"

#### Step 2: Understanding the Form

**Component Code** (`components/SendUSDC.tsx`):

```typescript
export function SendUSDC() {
  const { wallet, signTransaction } = useWallet();

  // Form inputs
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
}
```

#### Step 3: Enter Recipient Address
Paste a test Solana address in the "Recipient Address" field.

**Format:** Base58-encoded public key, usually ~44 characters
- Example: `11111111111111111111111111111111`
- Or: Your friend's wallet address

**Validation happens in real-time:**
```typescript
const validateInputs = (): boolean => {
  // Check format
  if (!isValidSolanaAddress(recipient)) {
    setError("Invalid recipient address format");
    return false;
  }

  // Check amount
  if (parseFloat(amount) <= 0) {
    setError("Amount must be greater than 0");
    return false;
  }

  // Check balance
  if (parseFloat(amount) > balance) {
    setError("Insufficient balance");
    return false;
  }

  return true;
};
```

#### Step 4: Enter Amount
Type the amount of USDC to send (e.g., `1.5` for 1.5 USDC).

**Notes:**
- Minimum: 0.01 USDC
- Maximum: 1,000,000 USDC (anti-accident limit)
- Decimals supported: 0.000001 USDC (due to 6 decimals)

#### Step 5: (Optional) Add Memo
Add a note like "Payment for services" or leave blank.

**Purpose:** On-chain record, visible on Solscan explorer.

---

#### Step 6: Click "Send USDC" Button

**What Happens Internally:**

```
Step 1: Validate Inputs
└─ Check address format, amount > 0, balance sufficient

Step 2: Build Unsigned Transaction
└─ Create USDC transfer instruction
   └─ Sender ATA → Recipient ATA
   └─ Amount converted to base units (1 USDC = 1,000,000 units)

Step 3: Sign with Passkey
└─ Browser shows biometric dialog again
└─ User completes Face ID / Fingerprint
└─ Transaction signed with passkey credential

Step 4: Submit to Paymaster
└─ Serialize transaction to base64
└─ Send to paymaster endpoint
└─ Paymaster receives and validates

Step 5: Paymaster Processing
└─ Add itself as fee payer
└─ Sign transaction
└─ Submit to Solana network

Step 6: Confirmation
└─ Wait for transaction to confirm (usually 15-30 sec)
└─ Return transaction signature to user
└─ Success! User saved gas fees
```

**Code Walkthrough:**

```typescript
const handleSendUSDC = async () => {
  // 1. Validate
  if (!validateInputs()) return;

  // 2. Build transaction
  const transaction = await buildUsdcTransfer({
    senderAddress: new PublicKey(wallet.address),
    recipientAddress: new PublicKey(recipient),
    amountUsdc: parseFloat(amount),
    memo: memo || undefined,
  });

  // 3. Sign with passkey
  const signedTransaction = await signTransaction(transaction);

  // 4. Submit to paymaster
  const result = await submitToPaymaster(
    signedTransaction,
    new PublicKey(wallet.address)
  );

  // 5. Show result
  if (result.success) {
    setSuccess(`✅ Transaction sent: ${result.transactionSignature}`);
  } else {
    setError(result.error);
  }
};
```

#### Step 7: Complete Biometric Verification
When prompted, complete the biometric auth again.

**Important:** This is using YOUR passkey to sign the transaction.
- No one else can send funds from your wallet
- Transaction is immutable once signed

#### Step 8: Success Message
After 15-30 seconds, you'll see:
```
✅ Transaction sent! Signature: abc123...
```

**What this means:**
- Transaction was confirmed on-chain
- USDC was transferred
- **No gas fees paid by you** (Paymaster covered it!)

---

### Verify on Solscan

To confirm the transaction really happened:

1. Copy the transaction signature from success message
2. Visit https://solscan.io/?cluster=devnet
3. Paste signature in search box
4. Click search
5. View complete transaction details:
   - Sender (your wallet)
   - Recipient
   - Amount transferred
   - Status: Success
   - Fee Payer: **Paymaster address** (not you!)

---

### Understanding Transaction Costs

**Without Paymaster:**
```
User wants to send 1 USDC
User needs:
├─ 1 USDC (for transfer)
└─ 0.00005 SOL (for gas) ← Must hold SOL!

User pays: 1.00005 USDC equivalent
User saved: $0 but had friction (needed SOL)
```

**With Paymaster (This Example):**
```
User wants to send 1 USDC
User needs:
└─ 1 USDC (for transfer)

Paymaster pays:
└─ 0.00005 SOL (for gas) ← Covered!

User pays: 1 USDC exactly
User saved: ~$0.00001 (but more importantly: no SOL friction!)
```

---

### Key Concepts: USDC Token Transfer

#### Understanding Token Accounts

```
Solana Wallet Address
  ├─ SOL Account (native currency)
  └─ USDC Token Account (SPL token)
      └─ Where USDC balance is stored

Transfer Flow:
User's USDC ATA → Recipient's USDC ATA

Transaction handles:
├─ Create recipient's USDC ATA if needed (costs lamports)
└─ Transfer USDC tokens
```

#### Base Units vs Human-Readable

```
USDC Decimals: 6
This means: 1 USDC = 1,000,000 base units

User Input: 1.5 USDC
Transaction: 1,500,000 base units

Code:
const amountInBaseUnits = Math.floor(
  amountUsdc * Math.pow(10, USDC_DECIMALS)
);
// 1.5 * 10^6 = 1,500,000
```

---

### Troubleshooting

**"Insufficient balance. You have 0 USDC available"**
- You have no USDC or need to get test tokens
- Get SOL: https://solfaucet.com
- Swap SOL to USDC using Jupiter or similar

**"Invalid recipient address format"**
- Recipient address is not valid Base58
- Copy-paste a correct Solana address
- Avoid adding spaces or line breaks

**"Transaction signing cancelled"**
- You clicked Cancel in the biometric dialog
- Try again and complete the biometric check

**"Paymaster rejected transaction"**
- Paymaster may be temporarily down
- Check paymaster health: `lib/paymaster.ts` → `checkPaymasterStatus()`
- Try again in a few moments

**"Recipient address is invalid" after sending**
- Address format was wrong
- Verify address again before sending

---

### Code Reference: SendUSDC Component

Location: `components/SendUSDC.tsx`

**Transaction Building:**
```typescript
// 1. Build (unsigned)
const transaction = await buildUsdcTransfer({
  senderAddress: new PublicKey(wallet.address),
  recipientAddress: new PublicKey(recipient),
  amountUsdc: parseFloat(amount),
});

// 2. Sign (passkey)
const signed = await signTransaction(transaction);

// 3. Submit (paymaster)
const result = await submitToPaymaster(signed, wallet.address);
```

**Helper Functions:**
```typescript
// Validation
isValidSolanaAddress(address)  // ✓ or ✗
hasUsdcBalance(wallet, amount) // ✓ or ✗
getUsdcBalance(wallet)         // Returns number

// Utilities
buildUsdcTransfer(params)
submitToPaymaster(tx, wallet)
parseTransactionError(error)
```

---

---

## Tutorial 3: Persist Session Across Devices (5 min)

### What You'll Learn
- How Lazorkit persists sessions in localStorage
- Cross-device credential sync mechanisms
- Secure session management
- Session refresh and timeout handling

### Prerequisites
- ✅ Completed Tutorial 1 & 2
- ✅ 2 devices (mobile + desktop recommended)
- ✅ Same passkey provider on both (iCloud Keychain, Google Password Manager)

---

### How Session Persistence Works

#### Local Storage (Single Device)

```
┌──────────────────────────────────────┐
│         Browser localStorage         │
├──────────────────────────────────────┤
│ key: "lazorkit_credential_id"        │
│ value: "credentialId_xyz123..."      │
│                                      │
│ key: "lazorkit_session_token"        │
│ value: "sessionToken_abc789..."      │
│                                      │
│ key: "lazorkit_wallet_address"       │
│ value: "4mA7Bi3NpJ8kZ9w1L4mQ5..."    │
└──────────────────────────────────────┘

When user returns:
1. App checks localStorage
2. Finds credential ID
3. Calls Lazorkit.reconnect()
4. Wallet automatically loaded
5. No passkey auth needed
```

**Code:**
```typescript
// Lazorkit handles this automatically
useEffect(() => {
  const walletFromStorage = await wallet.reconnect();
  if (walletFromStorage) {
    // User stays logged in
  }
}, []);
```

#### Cross-Device Sync

```
Desktop Setup
  ↓
Create Passkey + Connect Wallet
  ↓
Save credential to iCloud Keychain / Google Password Manager
  ↓
(Device Syncing in Background)
  ↓
Mobile Receives Credential Update
  ↓
Mobile Can Use Same Wallet
  ↓
Same Address: 4mA7Bi3NpJ8kZ9w1L4mQ5...
```

---

### Step-by-Step Guide

#### Step 1: Connect on Device 1 (Desktop)
```
1. Go to http://localhost:3000
2. Click "Connect with Passkey"
3. Complete biometric auth
4. See wallet address: 4mA7Bi3NpJ8kZ9w1L4mQ5...
5. Close browser tab
```

**Behind the scenes:**
```typescript
// Lazorkit saves to localStorage
localStorage.setItem(
  "lazorkit_credential_id",
  "credentialId_xyz123..."
);
localStorage.setItem(
  "lazorkit_session_token",
  "sessionToken_abc789..."
);
```

#### Step 2: Refresh Desktop - Verify Session Persists
```
1. Refresh page (Cmd+R or Ctrl+R)
2. See wallet still connected
3. No passkey prompt needed
```

**Why:** Lazorkit detected stored credential and re-established session.

---

#### Step 3: Same Passkey on Mobile
On a mobile device with the same passkey provider:

```
1. Open dApp in Safari (iOS) or Chrome (Android)
2. Click "Connect with Passkey"
3. Device prompts: "Use passkey from iCloud Keychain?" or similar
4. Complete biometric on mobile
5. See SAME wallet address: 4mA7Bi3NpJ8kZ9w1L4mQ5...
```

**Key insight:** Same passkey = Same derived wallet address

```
Passkey Derivation is Deterministic:
passkey → derive wallet → address

If you use the same passkey on Desktop and Mobile:
Desktop: passkey → 4mA7Bi3NpJ8kZ9w1L4mQ5...
Mobile:  passkey → 4mA7Bi3NpJ8kZ9w1L4mQ5... (same!)
```

---

#### Step 4: Use Wallet on Mobile
After connecting:
```
1. Mobile shows "Your USDC Balance: X"
2. Can send USDC from mobile
3. Each transaction signs with local biometric
4. Paymaster sponsors gas
```

**Sessions are independent:**
- Desktop localStorage ≠ Mobile localStorage
- But both can use same wallet address
- Because they use same underlying passkey

---

### Session Management Code

Location: `lib/config.ts`

```typescript
export const LAZORKIT_CONFIG = {
  // How long user stays logged in
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours

  // Where credentials are stored
  credentialStorage: "localStorage",
  // Options: "localStorage", "sessionStorage", "indexedDB"

  // Sync credentials across devices
  enableCrossDeviceSync: true,

  // Require biometric for transactions
  requireUserVerification: true,
};
```

**Session Lifecycle:**

```typescript
// 1. Initial connection
await connect({ feeMode: "paymaster" });
// Saves credential to storage, session starts

// 2. Automatic reconnect on app load
useEffect(() => {
  const restored = await wallet.reconnect();
  // If credential exists and session valid, user logged in
}, []);

// 3. Session timeout
// After 24 hours, session expires
// User must authenticate again

// 4. Manual disconnect
await disconnect();
// Clears session and credential from storage
```

---

### Security Considerations

#### What's Stored Locally?
```typescript
✓ Credential Reference ID (safe)
  - Just an identifier
  - Useless without the device

✗ NEVER stored:
  - Private keys
  - Seed phrases
  - Master secrets

The actual secret stays sealed on the device's secure enclave.
```

#### Cross-Device Sync Security
```
Your Passkey
  ↓
Device A securely stores
  ↓
Your OS syncs credential metadata
  (NOT the secret, just metadata)
  ↓
Device B receives metadata
  ↓
When used, Device B's biometric unlocks it
  ↓
Each device independently verifies biometric
```

#### Session Tokens
```typescript
// Session token is temporary
// Expires after timeout
// Cryptographically signed
// Sent with every transaction

// If token is compromised:
// - Only lasts 24 hours
// - Requires biometric to refresh
// - Tied to specific device
```

---

### Testing Cross-Device Session

#### Test 1: Same Browser, Different Tabs
```
1. Connect in Tab A
2. Open Tab B
3. See wallet connected in Tab B (shared localStorage)
4. Both tabs use same session
```

#### Test 2: Same Device, Incognito Window
```
1. Connect in Normal Window
2. Open Incognito/Private Window
3. Incognito is empty (separate localStorage)
4. Must connect again
```

#### Test 3: Same Passkey, Different Device
```
1. Connect Desktop with passkey "MyFaceID"
2. Wallet address: 4mA7Bi3NpJ8...
3. Connect Mobile with same "MyFaceID"
4. Wallet address: 4mA7Bi3NpJ8... (same!)
5. Both devices can send transactions from this wallet
```

---

### Advanced: Credential Persistence Code

Location: `components/WalletProvider.tsx`

```typescript
export function WalletProvider({ children }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // On app startup, try to restore session
    const restoreSession = async () => {
      try {
        const stored = localStorage.getItem("lazorkit_credential_id");

        if (stored) {
          // Credential exists, try to reconnect
          const wallet = await lazorkit.reconnect({
            credentialId: stored,
          });

          if (wallet) {
            // Session restored!
            setWallet(wallet);
          }
        }
      } catch (err) {
        console.warn("Session restore failed, requiring re-auth");
      }

      setIsLoaded(true);
    };

    restoreSession();
  }, []);

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  return (
    <LazorkitContext.Provider value={wallet}>
      {children}
    </LazorkitContext.Provider>
  );
}
```

---

### Troubleshooting

**"Passkey not available on this device"**
- Using a different passkey provider
- Solution: Create a new passkey on this device, or
- Use same passkey provider (iCloud on both iOS/macOS, Google on all Android)

**"Session expired after timeout"**
- 24 hours have passed since last use
- Must authenticate again
- This is intentional for security

**"Wallet address different on mobile vs desktop"**
- Using different passkeys
- Solution: Use same passkey provider and passkey across devices

**"localStorage shows empty on new device"**
- This is correct - each device has separate storage
- Wallet address should be same (if same passkey)
- Session persists per device

---

### Summary

**Session Persistence Pattern:**

```
┌──────────────────────────────────────────────────────┐
│ User Creates Passkey on Device A                     │
│ • Passkey stored in secure enclave                   │
│ • Credential ID saved to localStorage                │
│ • Session token issued                               │
└─────────────────┬──────────────────────────────────┘
                  │
          ┌───────┴───────┐
          │               │
    ┌─────▼─────┐   ┌─────▼──────┐
    │ Device A  │   │ Device B   │
    │ (Desktop) │   │ (Mobile)   │
    │           │   │            │
    │ localStorage
│   │ Stored    │   │ Empty      │
    │ Wallet: X │   │ Wallet: ?  │
    └─────┬─────┘   └─────┬──────┘
          │               │
    ┌─────▼──────────────▼─────┐
    │ Same Passkey = Same       │
    │ Derived Wallet Address: X │
    └───────────────────────────┘
    
Result:
✓ Device A: Session active, wallet X
✓ Device B: No session yet, but can connect with same passkey
✓ Both can send from wallet X once connected
✓ Each has separate session tokens
```

---

### Next Steps

After completing these tutorials:

1. **Deploy to Devnet** (see README deployment section)
2. **Share with other developers** - Your working example helps them get started
3. **Extend functionality** - Add more features like:
   - Transaction history
   - Multiple recipients
   - Scheduled transfers
   - Token swaps
4. **Write blog post** - Share your learnings on X/Twitter or Dev.to

---

## Additional Resources

### Lazorkit Documentation
- **Official Docs:** https://docs.lazorkit.com
- **GitHub Repo:** https://github.com/lazor-kit/lazor-kit
- **API Reference:** https://docs.lazorkit.com/api

### WebAuthn & Passkeys
- **WebAuthn Spec:** https://www.w3.org/TR/webauthn-2/
- **MDN Guide:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API

### Solana Development
- **Solana Docs:** https://docs.solana.com
- **SPL Token Guide:** https://spl.solana.com
- **Web3.js Documentation:** https://solana-labs.github.io/solana-web3.js/

### Related Blogs & Articles
- **Helius - Solana Passkeys:** https://www.helius.dev/blog/solana-passkeys
- **Solana Mobile - dApp Framework:** https://solanacookbook.com

---

**Now you're ready to build production-quality Solana dApps with Lazorkit! 🚀**
