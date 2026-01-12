// lib/paymaster.ts
// Paymaster integration for gasless transactions
// Handles communication with the paymaster service to sponsor gas fees

import { Transaction, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { PAYMASTER_URL } from "./config";

/**
 * Paymaster request format
 * This is what we send to the paymaster service
 */
interface PaymasterRequest {
  // Serialized transaction in base58 or base64
  transaction: string;
  // Optional: user wallet address (for accounting)
  userAddress?: string;
}

/**
 * Paymaster response format
 * This is what we get back from the paymaster service
 */
interface PaymasterResponse {
  // Was the request successful?
  success: boolean;
  // Serialized transaction with paymaster signature added
  transaction?: string;
  // Error message if failed
  error?: string;
}

/**
 * Submit a transaction to the paymaster for gas sponsorship
 *
 * What happens:
 * 1. User signs the transaction with their passkey
 * 2. We serialize the transaction
 * 3. We send it to the paymaster
 * 4. Paymaster verifies it's a valid transaction
 * 5. Paymaster adds itself as the fee payer
 * 6. Paymaster signs the transaction
 * 7. Paymaster submits to Solana network
 * 8. Transaction is confirmed
 *
 * Result: User never needed SOL for gas, paymaster covered it
 *
 * @param transaction - Signed transaction from user
 * @param userAddress - Optional wallet address for logging
 * @returns Response with confirmed transaction signature or error
 *
 * @example
 * const signedTx = await wallet.signTransaction(unsignedTx);
 * const result = await submitToPaymaster(signedTx, userWallet);
 * if (result.success) {
 *   console.log("Transaction sent:", result.transactionSignature);
 * } else {
 *   console.error("Paymaster rejected:", result.error);
 * }
 */
export async function submitToPaymaster(
  transaction: Transaction | VersionedTransaction,
  userAddress?: PublicKey
): Promise<{
  success: boolean;
  transactionSignature?: string;
  error?: string;
}> {
  try {
    // Step 1: Serialize the transaction to send to paymaster
    // We use base64 encoding as it's widely compatible
    const serializedTransaction = serializeTransaction(transaction);

    // Step 2: Prepare the request payload
    const paymasterRequest: PaymasterRequest = {
      transaction: serializedTransaction,
      userAddress: userAddress?.toString(),
    };

    // Step 3: Send to paymaster endpoint
    const response = await fetch(`${PAYMASTER_URL}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymasterRequest),
    });

    // Step 4: Parse the response
    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || `Paymaster error: ${response.statusText}`,
      };
    }

    const paymasterResponse: PaymasterResponse = await response.json();

    // Step 5: Check if paymaster accepted the transaction
    if (!paymasterResponse.success) {
      return {
        success: false,
        error: paymasterResponse.error || "Paymaster rejected transaction",
      };
    }

    // Step 6: Extract the transaction signature for tracking
    // The paymaster will submit the transaction and return the signature
    const transactionSignature = paymasterResponse.transaction || "pending";

    return {
      success: true,
      transactionSignature,
    };
  } catch (error) {
    console.error("Paymaster submission failed:", error);
    return {
      success: false,
      error: `Failed to submit to paymaster: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Check paymaster service status
 * Useful for health checks before attempting transactions
 *
 * @returns Service status and health info
 *
 * @example
 * const status = await checkPaymasterStatus();
 * if (!status.isHealthy) {
 *   console.log("Paymaster is down, use regular transaction");
 * }
 */
export async function checkPaymasterStatus(): Promise<{
  isHealthy: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`${PAYMASTER_URL}/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        isHealthy: false,
        error: `Paymaster unhealthy: ${response.statusText}`,
      };
    }

    return {
      isHealthy: true,
    };
  } catch (error) {
    return {
      isHealthy: false,
      error: `Failed to connect to paymaster: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Serialize a transaction to base64 string for transmission
 * Handles both regular Transaction and VersionedTransaction
 *
 * @param transaction - Solana transaction object
 * @returns Base64-encoded transaction
 */
function serializeTransaction(
  transaction: Transaction | VersionedTransaction
): string {
  try {
    let serialized: Buffer;

    if ("version" in transaction) {
      // VersionedTransaction (more modern)
      serialized = transaction.serialize({
        // Don't require signatures to be complete
        // Paymaster will add its signature
        requireAllSignatures: false,
        verifySignatures: false,
      });
    } else {
      // Legacy Transaction
      serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
    }

    // Encode to base64 for safe transmission
    return Buffer.from(serialized).toString("base64");
  } catch (error) {
    console.error("Failed to serialize transaction:", error);
    throw new Error(
      `Transaction serialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Deserialize a base64-encoded transaction back to a Transaction object
 * Used when receiving transaction data from the paymaster
 *
 * @param serialized - Base64-encoded transaction
 * @returns Deserialized transaction
 */
export function deserializeTransaction(
  serialized: string
): Transaction | VersionedTransaction {
  try {
    const buffer = Buffer.from(serialized, "base64");

    // Try to deserialize as VersionedTransaction first (modern format)
    try {
      return VersionedTransaction.deserialize(buffer);
    } catch {
      // Fall back to legacy Transaction format
      return Transaction.from(buffer);
    }
  } catch (error) {
    console.error("Failed to deserialize transaction:", error);
    throw new Error(
      `Transaction deserialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Estimate paymaster fee for a transaction
 * Shows user how much gas the paymaster would sponsor
 *
 * @param transaction - Transaction to estimate
 * @returns Estimated fee in lamports (usually 5000-10000)
 *
 * @example
 * const fee = await estimatePaymasterFee(tx);
 * console.log(`Paymaster will sponsor: ${fee} lamports of gas`);
 */
export async function estimatePaymasterFee(
  transaction: Transaction | VersionedTransaction
): Promise<number> {
  try {
    const serialized = serializeTransaction(transaction);

    const response = await fetch(`${PAYMASTER_URL}/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: serialized,
      }),
    });

    if (!response.ok) {
      // If estimation fails, return a reasonable default
      return 5000; // Default Solana transaction fee
    }

    const data = await response.json();
    return data.estimatedFee || 5000;
  } catch (error) {
    console.error("Failed to estimate paymaster fee:", error);
    // Return default if estimation fails
    return 5000;
  }
}

/**
 * Get paymaster stats and usage info
 * Useful for displaying to users (e.g., "Paymaster has sponsored X transactions")
 *
 * @returns Paymaster statistics
 *
 * @example
 * const stats = await getPaymasterStats();
 * console.log(`Total sponsored: ${stats.totalSponsored}`);
 */
export async function getPaymasterStats(): Promise<{
  totalSponsored?: number;
  totalSavings?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${PAYMASTER_URL}/stats`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        error: `Failed to get stats: ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      error: `Failed to fetch paymaster stats: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Simulate a transaction to check if it would succeed
 * Important: Run this before submitting to avoid wasting paymaster resources
 *
 * @param transaction - Transaction to simulate
 * @returns Simulation result with any errors
 */
export async function simulateTransaction(
  transaction: Transaction | VersionedTransaction
): Promise<{
  success: boolean;
  error?: string;
  logs?: string[];
}> {
  try {
    const serialized = serializeTransaction(transaction);

    const response = await fetch(`${PAYMASTER_URL}/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: serialized,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Simulation failed: ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: `Failed to simulate transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export default {
  submitToPaymaster,
  checkPaymasterStatus,
  deserializeTransaction,
  estimatePaymasterFee,
  getPaymasterStats,
  simulateTransaction,
};
