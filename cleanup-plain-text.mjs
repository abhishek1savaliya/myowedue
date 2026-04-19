import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Transaction from './src/models/Transaction.js';

dotenv.config({ path: '.env.local' });

async function cleanupPlainText() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔐 Starting plain text cleanup...\n');

    // Find all transactions that have encrypted versions but also have plain text
    const transactions = await Transaction.find({
      encryptedAmount: { $exists: true },
      amount: { $exists: true },
    });

    if (transactions.length === 0) {
      console.log('✓ No transactions with both plain and encrypted data found');
      process.exit(0);
    }

    console.log(`Found ${transactions.length} transactions to clean up\n`);

    let updated = 0;
    let errors = 0;

    for (const tx of transactions) {
      try {
        // Remove plain text fields, keep only encrypted versions
        await Transaction.findByIdAndUpdate(
          tx._id,
          {
            $unset: {
              amount: '',
              notes: '',
            },
          }
        );
        updated++;
        console.log(`✓ Cleaned transaction ${updated}/${transactions.length}`);
      } catch (err) {
        errors++;
        console.error(`✗ Error cleaning ${tx._id}: ${err.message}`);
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Cleaned: ${updated} transactions`);
    console.log(`   Errors: ${errors} transactions`);
    console.log(`\n🔒 All transactions now only have encrypted data!`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

cleanupPlainText();
