// lib/config.ts
// Lazorkit SDK Configuration
// Centralizes all setup, RPC endpoints, and environment variables

import { Cluster, PublicKey } from "@solana/web3.js";

/**
 * Solana cluster configuration
 * DEVNET = Testing environment (free SOL from faucet)
 * MAINNET_BETA = Production network (real transactions, real money)
 */
export const SOLANA_CLUSTER: Cluster = 
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as Cluster) || "devnet";

/**
 * RPC endpoint URL - directs Web3.js transactions to Solana network
 * Production: Use a dedicated RPC provider (Helius, Alchemy, Magic Eden)
 */
export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";

/**
 * Paymaster URL - enables gasless transactions
 * The paymaster intercepts transactions and sponsors gas fees
 * Without this: user must hold SOL to pay for transactions
 * With this: transactions are free for the user
 */
export const PAYMASTER_URL =
  process.env.NEXT_PUBLIC_PAYMASTER_URL ||
  "https://paymaster.dev.solana.com/v1";

/**
 * USDC Token Mint Address
 * This is the contract address for USDC on Solana
 * Devnet USDC: EPjFWaLb3odccjf2cj6ipYKeS78Gb6piFmqgWXb462o9
 * Mainnet USDC: EPjFWaLb3odccjf2cj6ipYKeS78Gb6piFmqgWXb462o9 (same)
 */
export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ||
    "EPjFWaLb3odccjf2cj6ipYKeS78Gb6piFmqgWXb462o9"
);

/**
 * USDC has 6 decimal places
 * Human-readable: 1 USDC = 1,000,000 base units
 * This constant helps convert between the two
 */
export const USDC_DECIMALS = 6;

/**
 * Lazorkit-specific configuration
 * These settings control how the SDK behaves
 */
export const LAZORKIT_CONFIG = {
  // feeMode: "paymaster" = Paymaster sponsors gas
  // feeMode: "user" = User pays gas (fallback if paymaster unavailable)
  feeMode: "paymaster" as const,

  // Session timeout (how long user stays logged in)
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

  // Store credentials securely
  credentialStorage: "localStorage", // Can be 'sessionStorage' or 'indexedDB'

  // Enable cross-device credential sync
  enableCrossDeviceSync: true,

  // Require user verification for transactions
  // This means: biometric or PIN must be provided
  requireUserVerification: true,
};

/**
 * Transaction settings
 */
export const TRANSACTION_CONFIG = {
  // Max fee for a transaction (failsafe if paymaster is down)
  maxFeePerTransaction: 5000, // lamports

  // Confirmation level
  // "finalized" = Most secure, slower
  // "confirmed" = Faster, still very secure
  // "processed" = Fastest, least secure
  confirmationLevel: "confirmed" as const,

  // How long to wait for transaction confirmation
  confirmationTimeout: 60000, // 60 seconds in milliseconds
};

/**
 * UI Configuration
 */
export const UI_CONFIG = {
  // Default avatar colors for wallet addresses
  avatarColors: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"],

  // Toast notification duration
  toastDuration: 5000, // milliseconds

  // Pagination size for transaction history
  txHistoryPageSize: 10,
};

/**
 * Helper function: Format lamports to SOL
 * @param lamports - Amount in lamports (smallest Solana unit)
 * @returns Amount in SOL (human-readable)
 * Example: 1,000,000,000 lamports = 1 SOL
 */
export const lamportsToSol = (lamports: number): number => {
  return lamports / 1_000_000_000;
};

/**
 * Helper function: Format USDC base units to human-readable USDC
 * @param baseUnits - Amount in base units (1 USDC = 1,000,000 base units)
 * @returns Amount in USDC (human-readable)
 */
export const baseUnitsToUsdc = (baseUnits: number): number => {
  return baseUnits / Math.pow(10, USDC_DECIMALS);
};

/**
 * Helper function: Convert human-readable USDC to base units
 * @param usdc - Amount in USDC
 * @returns Amount in base units
 * Example: 5 USDC = 5,000,000 base units
 */
export const usdcToBaseUnits = (usdc: number): number => {
  return Math.floor(usdc * Math.pow(10, USDC_DECIMALS));
};

export default {
  SOLANA_CLUSTER,
  RPC_URL,
  PAYMASTER_URL,
  USDC_MINT,
  USDC_DECIMALS,
  LAZORKIT_CONFIG,
  TRANSACTION_CONFIG,
  UI_CONFIG,
  lamportsToSol,
  baseUnitsToUsdc,
  usdcToBaseUnits,
};
