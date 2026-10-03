"use client";
import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignOutPage() {
  const { signOut } = useClerk();

  useEffect(() => {
    signOut({ redirectUrl: "/" });
  }, [signOut]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
          <span style={{ color: "var(--et-red)" }}>Easy</span>Tax
        </div>
        <div style={{ width: 32, height: 32, border: "3px solid #fee2e2", borderTopColor: "#E5342A", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 14 }}>Déconnexion en cours...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
