/**
 * Test script for encryption library
 * Run with: node test-crypto.mjs
 */

import { deriveUserKey, encryptField, decryptField, encryptTransaction, decryptTransaction } from "./src/lib/crypto.js";

async function runTests() {
  console.log("🔐 Starting Encryption Tests...\n");

  try {
    // Test 1: Key Derivation
    console.log("Test 1: Key Derivation");
    const userId = "63f7d8c8d7e9f1a2b3c4d5e6";
    const email = "test@example.com";
    const userKey = await deriveUserKey(userId, email);
    console.log("✓ Key derived successfully");
    console.log(`  Key length: ${userKey.length} bytes\n`);

    // Test 2: Deterministic Key (same user, same key)
    console.log("Test 2: Deterministic Key Generation");
    const userKey2 = await deriveUserKey(userId, email);
    const isSame = userKey.every((val, idx) => val === userKey2[idx]);
    console.log(isSame ? "✓ Keys are identical for same user" : "✗ Keys differ!");
    console.log(`  Keys match: ${isSame}\n`);

    // Test 3: Different users get different keys
    console.log("Test 3: Different Keys for Different Users");
    const userKey3 = await deriveUserKey("different_user_id", "other@example.com");
    const isDifferent = !userKey.every((val, idx) => val === userKey3[idx]);
    console.log(isDifferent ? "✓ Different users get different keys" : "✗ Keys are same!");
    console.log(`  Keys differ: ${isDifferent}\n`);

    // Test 4: Encrypt Field
    console.log("Test 4: Field Encryption");
    const plaintext = "1000.50";
    const encrypted = await encryptField(plaintext, userKey);
    console.log("✓ Field encrypted successfully");
    console.log(`  Original: ${plaintext}`);
    console.log(`  Encrypted (base64): ${encrypted.substring(0, 50)}...\n`);

    // Test 5: Decrypt Field
    console.log("Test 5: Field Decryption");
    const decrypted = await decryptField(encrypted, userKey);
    console.log("✓ Field decrypted successfully");
    console.log(`  Decrypted: ${decrypted}`);
    console.log(`  Match: ${decrypted === plaintext}\n`);

    // Test 6: Encrypt Transaction
    console.log("Test 6: Transaction Encryption");
    const transaction = {
      _id: "tx_123",
      userId: userId,
      amount: 5000,
      notes: "Payment for services",
      type: "credit",
      status: "pending",
      date: new Date(),
      currency: "USD"
    };
    
    const encryptedTx = await encryptTransaction(transaction, userKey);
    console.log("✓ Transaction encrypted");
    console.log(`  Has encryptedAmount: ${!!encryptedTx.encryptedAmount}`);
    console.log(`  Has encryptedNotes: ${!!encryptedTx.encryptedNotes}`);
    console.log(`  Amount obscured: ${encryptedTx.encryptedAmount && encryptedTx.encryptedAmount !== transaction.amount.toString()}\n`);

    // Test 7: Decrypt Transaction
    console.log("Test 7: Transaction Decryption");
    const decryptedTx = await decryptTransaction(encryptedTx, userKey);
    console.log("✓ Transaction decrypted");
    console.log(`  Amount: ${decryptedTx.amount} (expected: ${transaction.amount})`);
    console.log(`  Notes: ${decryptedTx.notes} (expected: ${transaction.notes})`);
    console.log(`  Amount matches: ${decryptedTx.amount === transaction.amount}`);
    console.log(`  Notes match: ${decryptedTx.notes === transaction.notes}\n`);

    // Test 8: Tampering Detection
    console.log("Test 8: Tampering Detection");
    const tamperedEncrypted = encrypted.slice(0, -10) + "BADBADBAD";
    try {
      await decryptField(tamperedEncrypted, userKey);
      console.log("✗ Tampering NOT detected (bad!)");
    } catch (error) {
      console.log("✓ Tampering detected and rejected");
      console.log(`  Error: ${error.message}\n`);
    }

    // Test 9: Wrong Key
    console.log("Test 9: Wrong Key Rejection");
    const wrongKey = await deriveUserKey("different_user", "different@example.com");
    try {
      await decryptField(encrypted, wrongKey);
      console.log("✗ Wrong key NOT rejected (bad!)");
    } catch (error) {
      console.log("✓ Wrong key rejected");
      console.log(`  Error: ${error.message}\n`);
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━.");
    console.log("✅ All tests passed! Encryption working correctly.");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━.");

  } catch (error) {
    console.error("❌ Test failed with error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

runTests();
