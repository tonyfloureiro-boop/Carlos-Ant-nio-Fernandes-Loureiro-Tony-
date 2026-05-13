import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
// @ts-ignore
import firebaseConfig from '../../firebase-applet-config.json';

// Log config safely (without API key)
console.log("Initializing Firebase for project:", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);

// Use named database if provided, otherwise default
const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== 'default' 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

export const db = getFirestore(app, dbId);
export const auth = getAuth(app);

// Connectivity Check
async function testConnection() {
  try {
    // Attempt to fetch a document from the server to verify connectivity
    // Using test/connection which we added to firestore.rules
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection verified successfully.");
  } catch (error: any) {
    // Standard connection failures often have 'unavailable' code
    if (error.code === 'unavailable' || error.message?.includes('the client is offline')) {
      console.warn("Firestore is currently unreachable. The app will work in offline mode, but changes may not sync until connection is restored.");
      console.error("Connectivity issue details:", error.message);
    } else if (error.code === 'permission-denied') {
      // Permission denied is actually GOOD for connectivity - it means we reached the server!
      console.log("Firestore reached, but access to test/connection was denied (as expected if rules are strict).");
    } else {
      console.error("Unexpected Firestore error during connectivity test:", error);
    }
  }
}

// Small delay to allow initialization to stabilize
setTimeout(testConnection, 1000);
