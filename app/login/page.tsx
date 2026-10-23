"use client";
import { useEffect, useState } from "react";

export default function Login() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { setName(localStorage.getItem("keiko-name") || ""); } catch {} }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || "Connexion impossible."); return; }
    try { localStorage.setItem("keiko-name", name); } catch {}
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") ? next : "/";
  }

  return (
    <main className="login">
      <form className="panel" onSubmit={submit}>
        <div className="panel-head" style={{ background: "var(--navy)", color: "var(--on-navy)", borderRadius: "10px 10px 0 0" }}>
          <div className="brand"><span className="rec" /><h1 style={{ fontSize: 18, color: "var(--on-navy)" }}>Ofi Studio</h1></div>
        </div>
        <div className="panel-body">
          <label className="f">Votre prénom<input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required /></label>
          <label className="f">Mot de passe de l'équipe<input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {err && <p className="msg bad" style={{ margin: 0 }}>{err}</p>}
          <button className="btn primary" disabled={busy} type="submit">{busy ? "Connexion…" : "Se connecter"}</button>
        </div>
      </form>
    </main>
  );
}
