// lib/transactions.ts
// Transaction builders and helpers for gasless USDC transfers
// These utilities construct and prepare transactions for the paymaster

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  getMint,
} from "@solana/spl-token";
import { RPC_URL, USDC_MINT, USDC_DECIMALS, PAYMASTER_URL } from "./config";

/**
 * Interface for gasless transaction parameters
 */
export interface GaslessTransactionParams {
  // User's wallet address (derived from passkey)
  senderAddress: PublicKey;
  // Recipient wallet address (where funds go)
  recipientAddress: PublicKey;
  // Amount in human-readable USDC (e.g., 5 for 5 USDC)
  amountUsdc: number;
  // Optional: custom memo or reference
  memo?: string;
}

/**
 * Interface for transaction response
 */
export interface TransactionResponse {
  success: boolean;
  signature?: string;
  error?: string;
  message: string;
}

/**
 * Create a Solana Connection instance
 * This object handles all RPC calls to the Solana network
 *
 * @returns Connection instance configured with the RPC endpoint
 */
export function createConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

/**
 * Build a USDC transfer transaction
 * This transaction includes:
 * 1. Check if recipient has a token account (ATA) for USDC
 * 2. If not, create one
 * 3. Transfer USDC from sender to recipient
 *
 * The transaction is NOT signed yet - the paymaster will add its signature
 *
 * @param params - Transaction parameters
 * @returns Unsigned transaction ready for paymaster
 *
 * @example
 * const tx = await buildUsdcTransfer({
 *   senderAddress: userWallet,
 *   recipientAddress: recipientWallet,
 *   amountUsdc: 5,
 * });
 * // Now sign with passkey and send to paymaster
 */
export async function buildUsdcTransfer(
  params: GaslessTransactionParams
): Promise<Transaction> {
  const connection = createConnection();

  // Convert human-readable USDC to base units
  // USDC has 6 decimals, so 1 USDC = 1,000,000 base units
  const amountInBaseUnits = Math.floor(
    params.amountUsdc * Math.pow(10, USDC_DECIMALS)
  );

  try {
    // Step 1: Get sender's token account (where USDC is stored)
    const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      params.senderAddress, // payer for account creation
      USDC_MINT,
      params.senderAddress // wallet owner
    );

    // Step 2: Get or create recipient's token account
    // If recipient doesn't have a USDC account yet, this creates one
    // The sender pays for the account creation (added to gas fees)
    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      params.senderAddress, // payer for account creation
      USDC_MINT,
      params.recipientAddress // wallet owner
    );

    // Step 3: Create the transfer instruction
    // This is the actual USDC movement
    const transferInstruction = createTransferInstruction(
      senderTokenAccount.address, // from token account
      recipientTokenAccount.address, // to token account
      params.senderAddress, // owner of sender account
      amountInBaseUnits // amount to transfer
    );

    // Step 4: Create transaction with the transfer instruction
    // We'll get the latest blockhash to ensure freshness
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: params.senderAddress, // Initially set sender as fee payer
      // The paymaster will add itself as fee payer later
    });

    // Add the transfer instruction
    transaction.add(transferInstruction);

    // Optional: Add memo instruction for on-chain reference
    if (params.memo) {
      const memoInstruction = createMemoInstruction(params.memo);
      transaction.add(memoInstruction);
    }

    return transaction;
  } catch (error) {
    console.error("Failed to build USDC transfer:", error);
    throw new Error(
      `Transaction building failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Create a memo instruction for on-chain record
 * Memo is stored in transaction metadata but doesn't affect execution
 *
 * @param memo - Text to store on-chain
 * @returns SystemProgram instruction for memo
 */
function createMemoInstruction(memo: string) {
  return SystemProgram.memo({
    data: Buffer.from(memo, "utf-8"),
  });
}

/**
 * Validate a wallet address before sending transaction
 * Prevents user error from sending funds to invalid addresses
 *
 * @param address - Wallet address to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * if (!isValidSolanaAddress(recipientAddress)) {
 *   toast.error("Invalid recipient address");
 *   return;
 * }
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if sender has enough USDC balance
 * Prevents sending more than the user owns
 *
 * @param senderAddress - Wallet address to check
 * @param requiredAmountUsdc - Amount in human-readable USDC
 * @returns true if sufficient balance, false otherwise
 *
 * @example
 * const hasFunds = await hasUsdcBalance(wallet, 10);
 * if (!hasFunds) {
 *   toast.error("Insufficient USDC balance");
 *   return;
 * }
 */
export async function hasUsdcBalance(
  senderAddress: PublicKey,
  requiredAmountUsdc: number
): Promise<boolean> {
  const connection = createConnection();

  try {
    const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      senderAddress,
      USDC_MINT,
      senderAddress
    );

    const balance = senderTokenAccount.amount.toNumber();
    const requiredBaseUnits = Math.floor(
      requiredAmountUsdc * Math.pow(10, USDC_DECIMALS)
    );

    return balance >= requiredBaseUnits;
  } catch {
    return false; // If account doesn't exist, no balance
  }
}

/**
 * Get current USDC balance of a wallet
 * Returns human-readable amount
 *
 * @param walletAddress - Wallet to check
 * @returns Balance in USDC (e.g., 5.25 for 5.25 USDC)
 *
 * @example
 * const balance = await getUsdcBalance(userWallet);
 * console.log(`Your balance: ${balance} USDC`);
 */
export async function getUsdcBalance(walletAddress: PublicKey): Promise<number> {
  const connection = createConnection();

  try {
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      walletAddress,
      USDC_MINT,
      walletAddress
    );

    const baseUnits = tokenAccount.amount.toNumber();
    return baseUnits / Math.pow(10, USDC_DECIMALS);
  } catch {
    return 0; // No account = 0 balance
  }
}

/**
 * Get USDC token supply and decimals (for reference)
 * Useful for UI or validation
 *
 * @returns Token info
 */
export async function getUsdcTokenInfo() {
  const connection = createConnection();

  try {
    const mint = await getMint(connection, USDC_MINT);
    return {
      supply: Number(mint.supply),
      decimals: mint.decimals,
      isInitialized: mint.isInitialized,
    };
  } catch (error) {
    console.error("Failed to fetch USDC token info:", error);
    throw error;
  }
}

/**
 * Estimate transaction cost in lamports
 * Used for showing users the gas fee (usually $0 with paymaster)
 *
 * @param transaction - Solana transaction to estimate
 * @returns Estimated fee in lamports
 *
 * Note: With paymaster enabled, this is shown as $0 to user
 */
export async function estimateTransactionCost(
  transaction: Transaction
): Promise<number> {
  // Standard transaction costs on Solana
  // Base fee: 5,000 lamports per signature
  // Each signature = 1 lamport

  const signatures = transaction.signatures.filter((sig) => sig.publicKey).length;
  const instructions = transaction.instructions.length;

  // Rough estimate: 5000 + (instructions * 1000) + (signatures * 1000)
  const estimatedLamports = 5000 + instructions * 1000 + signatures * 1000;

  return estimatedLamports;
}

/**
 * Parse transaction error into user-friendly message
 * Helps with debugging and better UX
 *
 * @param error - Transaction error
 * @returns User-friendly error message
 *
 * @example
 * catch (error) {
 *   const message = parseTransactionError(error);
 *   toast.error(message); // "Insufficient USDC balance"
 * }
 */
export function parseTransactionError(error: unknown): string {
  const errorStr = String(error).toLowerCase();

  if (errorStr.includes("insufficient funds")) {
    return "Insufficient SOL for gas fees";
  }
  if (errorStr.includes("invalid owner")) {
    return "Recipient address is invalid";
  }
  if (errorStr.includes("token owner did not sign")) {
    return "Transaction was not properly signed";
  }
  if (errorStr.includes("blockhash not found")) {
    return "Block expired - please retry";
  }
  if (errorStr.includes("network error")) {
    return "Network error - check your connection";
  }

  return "Transaction failed - please try again";
}

export default {
  createConnection,
  buildUsdcTransfer,
  isValidSolanaAddress,
  hasUsdcBalance,
  getUsdcBalance,
  getUsdcTokenInfo,
  estimateTransactionCost,
  parseTransactionError,
};
