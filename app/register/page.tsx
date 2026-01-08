"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, email, password }),
      })

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg)
      }

      // 注册成功后自动登录
      await signIn("credentials", {
        email,
        password,
        redirect: true,
        callbackUrl: "/",
      })
    } catch (e: any) {
      const msg = String(e?.message ?? "注册失败")
      setError(msg.includes("email already") ? "邮箱已被注册" : msg)
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 80% 20%, rgba(16,185,129,0.18), transparent 55%), linear-gradient(#0b1020, #070a12)",
        color: "white",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          boxShadow: "0 30px 120px rgba(0,0,0,0.55)",
          padding: 18,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 900 }}>Create account</div>
        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.68)" }}>
          注册后自动登录进入任务板
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.10)",
              color: "rgba(255,255,255,0.92)",
              fontSize: 13,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            autoComplete="name"
            style={inputStyle}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="email"
            style={inputStyle}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (>= 6 chars)"
            type="password"
            autoComplete="new-password"
            style={inputStyle}
          />

          <button
            disabled={loading || !email.trim() || password.length < 6}
            style={{
              marginTop: 6,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(16,185,129,0.35)",
              color: "white",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating..." : "Create & Sign in"}
          </button>
        </form>

        <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
          已有账号？{" "}
          <a href="/login" style={{ color: "white", fontWeight: 900 }}>
            去登录
          </a>
        </div>
      </div>
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
}
