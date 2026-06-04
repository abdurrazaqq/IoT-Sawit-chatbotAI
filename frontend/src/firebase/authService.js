import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, isFirebaseReady } from "./config.js";

export function subscribeAuth(callback) {
  if (!isFirebaseReady) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmail(email, password) {
  if (!isFirebaseReady) throw new Error("Firebase belum dikonfigurasi.");
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function logout() {
  if (!isFirebaseReady) return;
  await signOut(auth);
}
