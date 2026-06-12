// src/App.jsx — wraps your app with cloud save.
// If signed out → shows the sign-in screen.
// If signed in  → loads their saved state and hands it to your app.

import { useCloudSave } from "./lib/useCloudSave";
import AuthGate from "./components/AuthGate";
import CodeQuestApp from "./CodeQuestApp";

export default function App() {
  const { user, loading, initialState, save, signOut } = useCloudSave();

  if (!user) return <AuthGate />;
  if (loading || !initialState) {
    return <div style={{ padding: 40, color: "#aab3cc", fontFamily: "system-ui" }}>Loading your progress…</div>;
  }
  return <CodeQuestApp initialState={initialState} onPersist={save} onSignOut={signOut} />;
}
