import nacl from "tweetnacl";
import crypto from "crypto";

// Use secretbox directly
const { secretbox } = nacl;
const { randomBytes } = nacl;
const keyCache = global.__myowedueUserKeyCache || (global.__myowedueUserKeyCache = new Map());

/**
 * Convert string to Uint8Array (UTF-8)
 */
function stringToUint8Array(str) {
  return new Uint8Array(Buffer.from(str, "utf-8"));
}

/**
 * Convert Uint8Array to string (UTF-8)
 */
function uint8ArrayToString(arr) {
  return Buffer.from(arr).toString("utf-8");
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(arr) {
  return Buffer.from(arr).toString("base64");
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(str) {
  return new Uint8Array(Buffer.from(str, "base64"));
}

/**
 * Derive a consistent encryption key from user ID and email
 * This key is deterministic - same user will always get the same key
 */
export async function deriveUserKey(userId, email) {
  const cacheKey = `${userId}:${String(email || "").toLowerCase()}`;
  const cachedKey = keyCache.get(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }

  // Create a deterministic seed from user ID and email using SHA-512
  const hash = crypto
    .createHash("sha512")
    .update(`${userId}:${email}:encryption`)
    .digest();

  // Use first 32 bytes for nacl.secretBox key (which needs exactly 32 bytes)
  // Convert Buffer to Uint8Array
  const nextKey = new Uint8Array(hash.slice(0, 32));
  if (keyCache.size >= 200) {
    const oldestKey = keyCache.keys().next().value;
    if (oldestKey) keyCache.delete(oldestKey);
  }
  keyCache.set(cacheKey, nextKey);
  return nextKey;
}

/**
 * Encrypt sensitive data (amount, notes)
 * Uses NaCl SecretBox (XSalsa20-Poly1305) for authenticated encryption
 */
export async function encryptField(data, userKey) {
  // Convert data to JSON string for serialization
  const plaintext = typeof data === "string" ? data : JSON.stringify(data);

  // Generate random nonce (24 bytes)
  const nonce = randomBytes(24);

  // Ensure key is Uint8Array
  const key = userKey instanceof Uint8Array ? userKey : new Uint8Array(userKey);
  
  // Convert message to Uint8Array
  const message = stringToUint8Array(plaintext);

  // Encrypt - secretbox returns ciphertext + authentication tag
  const ciphertext = secretbox(message, nonce, key);

  if (!ciphertext) {
    throw new Error("Encryption failed - invalid parameters");
  }

  // Combine nonce + ciphertext and encode to base64
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, nonce.length);

  return uint8ArrayToBase64(combined);
}

/**
 * Decrypt sensitive data
 * Throws error if decryption fails (data was tampered with)
 */
export async function decryptField(encryptedData, userKey) {
  try {
    // Decode from base64
    const combined = base64ToUint8Array(encryptedData);

    // Split nonce and ciphertext
    const nonce = combined.slice(0, 24);
    const ciphertext = combined.slice(24);

    // Ensure key is Uint8Array
    const key = userKey instanceof Uint8Array ? userKey : new Uint8Array(userKey);

    // Decrypt - secretbox.open returns plaintext or null if auth fails
    const plaintext = secretbox.open(ciphertext, nonce, key);

    if (!plaintext) {
      throw new Error("Decryption failed - authentication tag mismatch or invalid ciphertext");
    }

    // Convert back from Uint8Array to string
    const result = uint8ArrayToString(plaintext);

    // Try to parse as JSON, fall back to string
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  } catch (error) {
    throw new Error(
      `Failed to decrypt field - ${error.message || "data may be corrupted or tampered"}`
    );
  }
}

/**
 * Encrypt a whole transaction object
 */
export async function encryptTransaction(transaction, userKey) {
  const encrypted = { ...transaction };

  // Encrypt sensitive fields
  if (transaction.amount != null) {
    encrypted.encryptedAmount = await encryptField(
      transaction.amount.toString(),
      userKey
    );
    // Remove plain text amount - only keep encrypted version
    delete encrypted.amount;
  }

  if (transaction.notes) {
    encrypted.encryptedNotes = await encryptField(transaction.notes, userKey);
    // Remove plain text notes - only keep encrypted version
    delete encrypted.notes;
  }

  return encrypted;
}

/**
 * Decrypt a transaction object
 */
export async function decryptTransaction(transaction, userKey) {
  const decrypted = { ...transaction };

  // Decrypt sensitive fields
  if (transaction.encryptedAmount) {
    try {
      const amount = await decryptField(transaction.encryptedAmount, userKey);
      decrypted.amount = parseFloat(amount);
    } catch (error) {
      console.error("Failed to decrypt amount:", error.message);
      // Keep encrypted field if decryption fails
    }
  }

  if (transaction.encryptedNotes) {
    try {
      decrypted.notes = await decryptField(transaction.encryptedNotes, userKey);
    } catch (error) {
      console.error("Failed to decrypt notes:", error.message);
      // Keep encrypted field if decryption fails
    }
  }

  return decrypted;
}

export async function decryptTransactionAmount(transaction, userKey) {
  if (!transaction?.encryptedAmount) {
    return Number(transaction?.amount ?? 0);
  }

  const amount = await decryptField(transaction.encryptedAmount, userKey);
  return parseFloat(amount);
}

/**
 * Generate a random encryption key (useful for testing)
 */
export function generateRandomKey() {
  return randomBytes(32);
}

export default {
  encryptField,
  decryptField,
  encryptTransaction,
  decryptTransaction,
  decryptTransactionAmount,
  deriveUserKey,
  generateRandomKey,
};
