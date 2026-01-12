// components/SendUSDC.tsx
// Gasless USDC transfer component
// Allows users to send USDC without holding SOL for gas

"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@lazor-kit/react";
import {
  buildUsdcTransfer,
  isValidSolanaAddress,
  hasUsdcBalance,
  parseTransactionError,
  getUsdcBalance,
} from "@/lib/transactions";
import { submitToPaymaster } from "@/lib/paymaster";
import styles from "./SendUSDC.module.css";

/**
 * SendUSDC Component
 *
 * This component demonstrates a complete gasless transaction flow:
 *
 * Flow:
 * 1. User enters recipient address and amount
 * 2. We validate the inputs (address format, balance)
 * 3. Build USDC transfer transaction (unsigned)
 * 4. User signs with passkey (automatic biometric)
 * 5. Send to paymaster for gas sponsorship
 * 6. Paymaster signs and submits to Solana
 * 7. Transaction confirmed → no gas fees paid by user
 *
 * Key insight: The paymaster covers gas costs entirely.
 * User only needs USDC, not SOL.
 */
export function SendUSDC() {
  // Wallet state from Lazorkit
  const { wallet, signTransaction } = useWallet();

  // Form state
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  /**
   * Fetch user's USDC balance on component mount
   * Shows user how much they can send
   */
  useEffect(() => {
    if (!wallet?.address) return;

    const fetchBalance = async () => {
      try {
        const bal = await getUsdcBalance(new PublicKey(wallet.address));
        setBalance(bal);
      } catch (err) {
        console.error("Failed to fetch balance:", err);
        // Don't show error to user - balance is just informational
      }
    };

    fetchBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [wallet?.address]);

  /**
   * Validate form inputs
   * Returns true if valid, false otherwise
   */
  const validateInputs = (): boolean => {
    setError(null);

    // Check recipient address
    if (!recipient.trim()) {
      setError("Please enter a recipient address");
      return false;
    }

    if (!isValidSolanaAddress(recipient)) {
      setError("Invalid recipient address format");
      return false;
    }

    // Check amount
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter an amount greater than 0");
      return false;
    }

    // Check amount is reasonable (max 1 million USDC to prevent accidents)
    if (parseFloat(amount) > 1_000_000) {
      setError("Amount too large - max 1,000,000 USDC");
      return false;
    }

    // Check balance
    if (balance !== null && parseFloat(amount) > balance) {
      setError(
        `Insufficient balance. You have ${balance.toFixed(2)} USDC available.`
      );
      return false;
    }

    return true;
  };

  /**
   * Handle gasless transaction submission
   */
  const handleSendUSDC = async () => {
    try {
      // Validate inputs
      if (!validateInputs()) return;

      // Verify wallet is connected
      if (!wallet?.address) {
        setError("Wallet not connected");
        return;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);

      // Step 1: Build the unsigned transaction
      const transaction = await buildUsdcTransfer({
        senderAddress: new PublicKey(wallet.address),
        recipientAddress: new PublicKey(recipient),
        amountUsdc: parseFloat(amount),
        memo: memo || undefined,
      });

      // Step 2: Sign transaction with passkey
      // This will show a biometric prompt to the user
      const signedTransaction = await signTransaction(transaction);

      if (!signedTransaction) {
        setError("Transaction signing cancelled or failed");
        return;
      }

      // Step 3: Submit to paymaster
      // The paymaster will add its signature and submit to Solana
      const paymasterResult = await submitToPaymaster(
        signedTransaction,
        new PublicKey(wallet.address)
      );

      if (!paymasterResult.success) {
        setError(paymasterResult.error || "Paymaster submission failed");
        return;
      }

      // Success!
      const signature = paymasterResult.transactionSignature;
      setSuccess(
        `✅ Transaction sent! Signature: ${signature?.substring(0, 8)}...`
      );

      // Reset form
      setRecipient("");
      setAmount("");
      setMemo("");

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      const errorMessage = parseTransactionError(err);
      setError(errorMessage);
      console.error("Transaction error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Show message if wallet not connected
  if (!wallet?.address) {
    return (
      <div className={styles.container}>
        <div className={styles.placeholder}>
          <p>👛 Connect your wallet to send USDC</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Send USDC (Gasless)</h2>
        <p>No SOL needed—paymaster covers gas fees</p>
      </div>

      {/* Balance display */}
      {balance !== null && (
        <div className={styles.balanceBox}>
          <span className={styles.balanceLabel}>Your USDC Balance:</span>
          <span className={styles.balanceAmount}>
            {balance.toFixed(2)} USDC
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className={styles.alert} role="alert">
          <span className={styles.alertIcon}>❌</span>
          <p>{error}</p>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className={styles.successAlert} role="status">
          <span className={styles.successIcon}>✅</span>
          <p>{success}</p>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendUSDC();
        }}
        className={styles.form}
      >
        {/* Recipient Address Input */}
        <div className={styles.formGroup}>
          <label htmlFor="recipient" className={styles.label}>
            Recipient Address
          </label>
          <input
            id="recipient"
            type="text"
            placeholder="Enter Solana wallet address"
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              setError(null); // Clear error on input change
            }}
            disabled={loading}
            className={styles.input}
          />
          <small className={styles.hint}>
            A public key starting with a letter or number
          </small>
        </div>

        {/* Amount Input */}
        <div className={styles.formGroup}>
          <label htmlFor="amount" className={styles.label}>
            Amount (USDC)
          </label>
          <div className={styles.amountInput}>
            <input
              id="amount"
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              disabled={loading}
              className={styles.input}
            />
            <span className={styles.currency}>USDC</span>
          </div>
        </div>

        {/* Memo Input (Optional) */}
        <div className={styles.formGroup}>
          <label htmlFor="memo" className={styles.label}>
            Memo <span className={styles.optional}>(Optional)</span>
          </label>
          <input
            id="memo"
            type="text"
            placeholder="Add a note for this transaction"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            disabled={loading}
            maxLength={100}
            className={styles.input}
          />
          <small className={styles.hint}>
            On-chain note, visible in transaction explorer
          </small>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={loading || !recipient || !amount}
          className={styles.sendBtn}
        >
          {loading ? (
            <>
              <span className={styles.spinner}></span>
              Sending...
            </>
          ) : (
            <>
              <span className={styles.icon}>📤</span>
              Send USDC
            </>
          )}
        </button>
      </form>

      {/* Info section */}
      <div className={styles.infoBox}>
        <h4>How Gasless Works</h4>
        <ol>
          <li>You fill out the transfer details</li>
          <li>Sign with your biometric (Face ID / Fingerprint)</li>
          <li>Paymaster sponsors the transaction fee</li>
          <li>Your USDC is sent instantly</li>
          <li>You save money on gas! 💰</li>
        </ol>
      </div>

      {/* Fee display */}
      <div className={styles.feeBox}>
        <span className={styles.feeLabel}>Transaction Fee:</span>
        <span className={styles.feeAmount}>$0 (Sponsored)</span>
      </div>
    </div>
  );
}

export default SendUSDC;
