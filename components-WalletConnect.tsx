// components/WalletConnect.tsx
// Passkey authentication component
// Allows users to connect their wallet using WebAuthn/passkeys

"use client";

import { useState } from "react";
import { useWallet } from "@lazor-kit/react";
import styles from "./WalletConnect.module.css";

/**
 * WalletConnect Component
 *
 * This component handles the entire passkey authentication flow:
 * 1. User clicks "Connect with Passkey"
 * 2. Browser opens biometric/security key dialog
 * 3. User completes authentication
 * 4. Lazorkit derives wallet from passkey
 * 5. Session persisted, user logged in
 *
 * No seed phrases. No manual key management.
 * Just biometric auth and ready to transact.
 */
export function WalletConnect() {
  const { wallet, connect, disconnect, isConnecting } = useWallet();
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle passkey connection
   * Triggers the browser's WebAuthn dialog
   */
  const handleConnect = async () => {
    try {
      setError(null);

      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        setError(
          "Your browser doesn't support passkeys. Please use Chrome, Firefox, or Safari."
        );
        return;
      }

      // Call Lazorkit's connect method
      // This will:
      // 1. Open biometric/security key dialog
      // 2. Derive Solana wallet from passkey credential
      // 3. Store credential ID for future logins
      await connect({
        // Use paymaster for gasless transactions
        feeMode: "paymaster",

        // Require user verification (biometric/PIN)
        userVerification: "preferred",

        // Allow attestation for security keys
        attestation: "none", // Use "direct" for production
      });
    } catch (err) {
      // Handle specific error types
      const message = err instanceof Error ? err.message : "Connection failed";

      if (message.includes("NotAllowedError")) {
        setError("Passkey connection cancelled");
      } else if (message.includes("NotSupportedError")) {
        setError("Passkeys not supported on this device");
      } else if (message.includes("InvalidStateError")) {
        setError("This passkey is already registered");
      } else {
        setError(message);
      }

      console.error("Wallet connection error:", err);
    }
  };

  /**
   * Handle disconnect
   * Clears session and requires passkey auth again on next visit
   */
  const handleDisconnect = async () => {
    try {
      await disconnect();
      setError(null);
    } catch (err) {
      setError("Failed to disconnect");
      console.error("Disconnect error:", err);
    }
  };

  // Show connected state
  if (wallet?.address) {
    return (
      <div className={styles.walletContainer}>
        <div className={styles.walletInfo}>
          <div className={styles.walletLabel}>Connected Wallet</div>
          <div className={styles.walletAddress}>
            {/* Truncate for display */}
            {wallet.address.substring(0, 4)}...
            {wallet.address.substring(wallet.address.length - 4)}
          </div>

          {/* Show wallet type (optional) */}
          {wallet.type && (
            <div className={styles.walletType}>{wallet.type}</div>
          )}
        </div>

        <button
          onClick={handleDisconnect}
          className={styles.disconnectBtn}
          disabled={isConnecting}
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Show connection UI
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Welcome to Lazorkit</h2>
        <p>Sign in with your passkey—no seed phrase needed</p>
      </div>

      {/* Error message */}
      {error && (
        <div className={styles.errorAlert} role="alert">
          <span className={styles.errorIcon}>⚠️</span>
          <div>
            <div className={styles.errorTitle}>Connection Failed</div>
            <div className={styles.errorMessage}>{error}</div>
          </div>
        </div>
      )}

      {/* Connect button */}
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className={styles.connectBtn}
      >
        {isConnecting ? (
          <>
            <span className={styles.spinner}></span>
            Connecting...
          </>
        ) : (
          <>
            <span className={styles.icon}>🔐</span>
            Connect with Passkey
          </>
        )}
      </button>

      {/* Info section */}
      <div className={styles.infoBox}>
        <h3>What is a Passkey?</h3>
        <ul>
          <li>🔒 Biometric authentication (Face ID, Fingerprint, etc.)</li>
          <li>🚫 No passwords. No seed phrases.</li>
          <li>✨ Works on desktop and mobile</li>
          <li>📱 Syncs across your devices</li>
        </ul>
      </div>

      {/* System check */}
      <div className={styles.systemCheck}>
        {window.PublicKeyCredential ? (
          <span className={styles.compatible}>✓ Passkeys supported</span>
        ) : (
          <span className={styles.incompatible}>✗ Passkeys not supported</span>
        )}
      </div>
    </div>
  );
}

export default WalletConnect;
