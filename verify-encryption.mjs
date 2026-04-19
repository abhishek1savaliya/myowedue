import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env.local' });
import Transaction from './src/models/Transaction.js';
import { deriveUserKey, decryptField } from './src/lib/crypto.js';

async function verifyEncryption() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to database\n');

    const transactions = await Transaction.find().limit(5);
    
    if (transactions.length === 0) {
      console.log('ℹ️  No transactions found in database');
      process.exit(0);
    }

    console.log(`Found ${transactions.length} recent transactions\n`);
    console.log('═'.repeat(80));
    
    for (const tx of transactions) {
      const txObj = tx.toObject();
      console.log(`\nTransaction ID: ${tx._id}`);
      console.log('─'.repeat(80));
      
      console.log('Fields in database:');
      if (txObj.amount !== undefined) {
        console.log(`  ❌ PLAIN TEXT amount: ${txObj.amount} (should NOT exist!)`);
      } else {
        console.log(`  ✓ No plain text amount (good)`);
      }
      
      if (txObj.notes !== undefined && txObj.notes !== '') {
        console.log(`  ❌ PLAIN TEXT notes: "${txObj.notes}" (should NOT exist!)`);
      } else {
        console.log(`  ✓ No plain text notes (good)`);
      }
      
      if (txObj.encryptedAmount) {
        console.log(`  ✓ Encrypted amount present: ${txObj.encryptedAmount.slice(0, 40)}...`);
      } else {
        console.log(`  ⚠️  No encrypted amount`);
      }
      
      if (txObj.encryptedNotes) {
        console.log(`  ✓ Encrypted notes present: ${txObj.encryptedNotes.slice(0, 40)}...`);
      } else {
        console.log(`  ⚠️  No encrypted notes`);
      }
      
      // Try to decrypt
      try {
        const user = await mongoose.model('User').findById(txObj.userId);
        if (user) {
          const userKey = await deriveUserKey(user._id.toString(), user.email);
          
          if (txObj.encryptedAmount) {
            const decrypted = await decryptField(txObj.encryptedAmount, userKey);
            console.log(`  ✓ Decrypted amount: ${decrypted}`);
          }
          
          if (txObj.encryptedNotes) {
            const decrypted = await decryptField(txObj.encryptedNotes, userKey);
            console.log(`  ✓ Decrypted notes: "${decrypted}"`);
          }
        }
      } catch (err) {
        console.log(`  ⚠️  Could not decrypt: ${err.message}`);
      }
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ Verification complete!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

verifyEncryption();
