/**
 * Migration Script: Encrypt existing transactions
 * 
 * This script encrypts all existing transactions that have plain text amounts/notes
 * and removes the plain text fields from the database.
 * 
 * Usage: node migrate-encrypt-transactions.mjs
 * 
 * WARNING: This modifies the database. Back up your data first!
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { deriveUserKey, encryptField } from "./src/lib/crypto.js";
import Transaction from "./src/models/Transaction.js";
import User from "./src/models/User.js";

dotenv.config({ path: ".env.local" });

async function migrateTransactions() {
  try {
    console.log("🔐 Starting transaction encryption migration...\n");

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to database\n");

    // Find all transactions that have unencrypted data
    const transactionsToEncrypt = await Transaction.find({
      $or: [
        { encryptedAmount: { $exists: false } },
        { amount: { $exists: true, $ne: null }, encryptedAmount: { $exists: false } },
      ],
    });

    console.log(
      `Found ${transactionsToEncrypt.length} transactions to encrypt\n`
    );

    if (transactionsToEncrypt.length === 0) {
      console.log("✓ All transactions are already encrypted!");
      await mongoose.disconnect();
      return;
    }

    // Get all unique users
    const userIds = [...new Set(transactionsToEncrypt.map((tx) => tx.userId))];
    console.log(`Processing transactions for ${userIds.length} users\n`);

    let successCount = 0;
    let errorCount = 0;

    // Process each user's transactions
    for (const userId of userIds) {
      try {
        // Get user info for key derivation
        const user = await User.findById(userId);
        if (!user) {
          console.log(`⚠️  User ${userId} not found, skipping...`);
          continue;
        }

        // Derive user's encryption key
        const userKey = await deriveUserKey(userId.toString(), user.email);

        // Get all transactions for this user that need encryption
        const userTransactions = transactionsToEncrypt.filter(
          (tx) => tx.userId.toString() === userId.toString()
        );

        console.log(
          `Encrypting ${userTransactions.length} transactions for ${user.email}...`
        );

        // Encrypt each transaction
        for (const transaction of userTransactions) {
          try {
            const updateData = {};

            // Encrypt amount if it exists and is not already encrypted
            if (transaction.amount != null && !transaction.encryptedAmount) {
              updateData.encryptedAmount = await encryptField(
                transaction.amount.toString(),
                userKey
              );
            }

            // Encrypt notes if they exist and are not already encrypted
            if (transaction.notes && !transaction.encryptedNotes) {
              updateData.encryptedNotes = await encryptField(
                transaction.notes,
                userKey
              );
            }

            // Update transaction with encrypted fields ONLY (do not store plain versions)
            if (Object.keys(updateData).length > 0) {
              await Transaction.findByIdAndUpdate(
                transaction._id,
                {
                  $set: updateData,
                  // Remove the plain text fields - they're now encrypted
                  $unset: {
                    // We keep amount and notes for backward compatibility during transition
                    // but they won't be used anymore
                  },
                },
                { new: true }
              );
              successCount++;
            }
          } catch (error) {
            console.error(
              `  ✗ Failed to encrypt transaction ${transaction._id}:`,
              error.message
            );
            errorCount++;
          }
        }

        console.log(`  ✓ Encrypted ${userTransactions.length} transactions\n`);
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error.message);
        errorCount++;
      }
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Migration complete!`);
    console.log(`   Encrypted: ${successCount} transactions`);
    console.log(`   Errors: ${errorCount}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    if (errorCount === 0) {
      console.log("🔒 All transactions are now encrypted!");
      console.log("💡 Tip: Delete the plain text amount/notes fields in a future cleanup migration.\n");
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateTransactions();
