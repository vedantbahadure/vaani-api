import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Firestore,
} from "firebase/firestore";

// Fallback config if JSON isn't directly resolved
const firebaseConfig = {
  projectId: "gen-lang-client-0448263799",
  appId: "1:263727932936:web:1283956a77d6f756a2d3bd",
  apiKey: "AIzaSyDxkjjaMoXn9_Iw7Dr0YlbvcHPT6o1ZYhE",
  authDomain: "gen-lang-client-0448263799.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-vaani03-43a5a1d1-d496-4d81-81ea-f36337a278a1",
  storageBucket: "gen-lang-client-0448263799.firebasestorage.app",
  messagingSenderId: "263727932936",
  oAuthClientId: "263727932936-6hqm1p8h3ku2ja15lm8k7rc6cjl8ikrm.apps.googleusercontent.com",
};

// Initialize Firebase App instance safely (singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
// Add Google Drive & Google Picker OAuth scopes
googleProvider.addScope("https://www.googleapis.com/auth/drive.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
googleProvider.addScope("https://www.googleapis.com/auth/drive.metadata.readonly");

let inMemoryGoogleToken: string | null = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("gdrive_access_token") : null;

export function getGoogleOAuthToken(): string | null {
  if (inMemoryGoogleToken) return inMemoryGoogleToken;
  if (typeof sessionStorage !== "undefined") {
    return sessionStorage.getItem("gdrive_access_token");
  }
  return null;
}

export function setGoogleOAuthToken(token: string | null) {
  inMemoryGoogleToken = token;
  if (typeof sessionStorage !== "undefined") {
    if (token) {
      sessionStorage.setItem("gdrive_access_token", token);
    } else {
      sessionStorage.removeItem("gdrive_access_token");
    }
  }
}

// Initialize Firestore with specific database ID from config
export const db: Firestore = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || "(default)"
);

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Capture OAuth access token for Google Drive & Google Picker APIs
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setGoogleOAuthToken(credential.accessToken);
    }

    if (user) {
      // Sync user profile to Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    return user;
  } catch (error: any) {
    console.error("Firebase Sign-in error:", error);
    throw error;
  }
}

export async function signOutUser() {
  try {
    setGoogleOAuthToken(null);
    await fbSignOut(auth);
  } catch (error) {
    console.error("Firebase Sign-out error:", error);
    throw error;
  }
}

export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
};
export type { User };
