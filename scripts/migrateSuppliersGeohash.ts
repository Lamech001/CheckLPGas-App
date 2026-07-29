/**
 * Migration script to add geohash field to existing supplier documents
 * Run this script once to update all existing suppliers with geohash values
 * 
 * Usage: npx ts-node scripts/migrateSuppliersGeohash.ts
 */

import { db } from '../config/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { generateGeohash } from '../utils/geohashUtils';

async function migrateSuppliers() {
  console.log('Starting geohash migration for suppliers...');

  try {
    const suppliersRef = collection(db, 'suppliers');
    const snapshot = await getDocs(suppliersRef);

    const totalSuppliers = snapshot.docs.length;
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log(`Found ${totalSuppliers} suppliers to process`);

    for (const docSnapshot of snapshot.docs) {
      const supplierData = docSnapshot.data();
      const supplierId = docSnapshot.id;

      try {
        // Skip if already has geohash
        if (supplierData.geohash) {
          console.log(`Skipping ${supplierId} - already has geohash`);
          skippedCount++;
          continue;
        }

        // Check if supplier has location
        if (!supplierData.location || !supplierData.location.latitude || !supplierData.location.longitude) {
          console.log(`Skipping ${supplierId} - missing location data`);
          skippedCount++;
          continue;
        }

        // Generate geohash
        const geohash = generateGeohash(
          supplierData.location.latitude,
          supplierData.location.longitude,
          6
        );

        // Update document
        await updateDoc(doc(db, 'suppliers', supplierId), {
          geohash,
        });

        migratedCount++;
        console.log(`Migrated ${supplierId} with geohash: ${geohash}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error migrating ${supplierId}:`, error);
        errorCount++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total suppliers: ${totalSuppliers}`);
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('Migration complete!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateSuppliers()
  .then(() => {
    console.log('Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
