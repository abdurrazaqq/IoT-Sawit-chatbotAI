import { useState } from "react";
import { isFirebaseReady } from "../firebase/config.js";
import { loginWithEmail, logout } from "../firebase/authService.js";

export default function AuthPanel({ user }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      setOpen(false);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isFirebaseReady) {
    return <Badge label="Firebase OFFLINE" color="#6b829e" />;
  }

  if (user) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Badge label={user.email || "Firebase READY"} color="#00e676" />
        <button type="button" onClick={logout} style={smallButton}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((value) => !value)} style={smallButton}>
        Login Firebase
      </button>
      {open && (
        <form
          onSubmit={submit}
          style={{
            position: "absolute",
            right: 0,
            top: 42,
            zIndex: 200,
            width: 280,
            background: "#0a1628",
            border: "1px solid #1e3a5f",
            borderRadius: 8,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            boxShadow: "0 12px 40px #0008"
          }}
        >
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email admin" type="email" style={inputStyle} />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" style={inputStyle} />
          {error && <div style={{ color: "#ef5350", fontSize: 11 }}>{error}</div>}
          <button disabled={loading} type="submit" style={{ ...smallButton, width: "100%", color: "#4fc3f7" }}>
            {loading ? "Login..." : "Masuk"}
          </button>
        </form>
      )}
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{ border: `1px solid ${color}66`, color, borderRadius: 8, padding: "7px 10px", fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

const smallButton = {
  background: "#0d1b2a",
  border: "1px solid #1e3a5f",
  borderRadius: 8,
  padding: "7px 10px",
  color: "#8099b8",
  cursor: "pointer",
  fontSize: 11
};

const inputStyle = {
  width: "100%",
  background: "#132236",
  border: "1px solid #1e3a5f",
  borderRadius: 6,
  padding: "8px 10px",
  color: "#e0f0ff",
  fontSize: 12
};
