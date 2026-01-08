"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { validateTaskTitle } from "@/lib/validators/task"

type Task = { id: string; title: string; done: boolean; createdAt: string }
type Filter = "all" | "active" | "done"

function formatTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function getInitials(name?: string | null) {
  const n = (name ?? "").trim()
  if (!n) return "U"
  // 简单取首字母/首字符
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase()
}

export default function BoardClient() {
  const { data: session, status } = useSession()
  const userName = (session?.user as any)?.name ?? (session?.user as any)?.username ?? "User"
  const userEmail = (session?.user as any)?.email ?? ""
  const userImage = (session?.user as any)?.image ?? ""
  const authed = status === "authenticated"

  const [title, setTitle] = useState("")
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string>("")
  const [filter, setFilter] = useState<Filter>("all")
  const [q, setQ] = useState("")

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const editRef = useRef<HTMLTextAreaElement | null>(null)

  // per-card menu
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // user menu (top-right)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  // undo delete
  const [undo, setUndo] = useState<{ task: Task; timer: any } | null>(null)

  const total = tasks.length
  const remaining = useMemo(() => tasks.filter((t) => !t.done).length, [tasks])
  const doneCount = total - remaining

  useEffect(() => {
    if (editingId) {
      const t = setTimeout(() => editRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [editingId])

  // close menus on outside click / esc
  useEffect(() => {
    function onDown(e: MouseEvent) {
      // card menu
      if (menuOpenId) {
        const el = menuRef.current
        if (el && !el.contains(e.target as Node)) setMenuOpenId(null)
      }
      // user menu
      if (userMenuOpen) {
        const uel = userMenuRef.current
        if (uel && !uel.contains(e.target as Node)) setUserMenuOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpenId(null)
        setUserMenuOpen(false)
      }
    }
    window.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [menuOpenId, userMenuOpen])

  async function refresh() {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as Task[]
      setTasks(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e?.message ?? "Failed to load tasks")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase()
    let list = [...tasks]

    if (filter === "active") list = list.filter((t) => !t.done)
    if (filter === "done") list = list.filter((t) => t.done)

    if (text) list = list.filter((t) => (t.title ?? "").toLowerCase().includes(text))

    // 未完成优先，时间新优先
    list.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return list
  }, [tasks, filter, q])

async function add() {
  if (adding || busyId) return

  const v = validateTaskTitle(title)
  if (!v.ok) {
    setError(v.error)
    return
  }

  const nextTitle = v.value

  setError("")
  setAdding(true)
  try {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle }),
    })
    if (!res.ok) throw new Error(await res.text())

    // UX：新增成功后的状态收敛
    setTitle("")
    setQ("")              // 清空搜索，保证新任务可见
    setFilter("all")      // 切回 All，避免“加了但看不到”
    await refresh()
  } catch (e: any) {
    setError(e?.message ?? "Add failed")
  } finally {
    setAdding(false)
  }
}


  async function toggle(id: string, done: boolean) {
    if (busyId) return
    setError("")
    setBusyId(id)

    // optimistic
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, done: !done } : x)))

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !done }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (e: any) {
      setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, done } : x)))
      setError(e?.message ?? "Update failed")
    } finally {
      setBusyId(null)
    }
  }

  function startEdit(t: Task) {
    if (busyId) return
    setMenuOpenId(null)
    setEditingId(t.id)
    setEditingTitle(t.title)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingTitle("")
  }

  async function saveEdit(id: string) {
    const next = editingTitle.trim()
    if (!next) {
      setError("Title cannot be empty")
      return
    }
    const original = tasks.find((x) => x.id === id)
    if (!original) return cancelEdit()
    if (next === original.title) return cancelEdit()

    if (busyId) return
    setError("")
    setBusyId(id)

    // optimistic
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, title: next } : x)))

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      })
      if (!res.ok) throw new Error(await res.text())
      cancelEdit()
    } catch (e: any) {
      setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, title: original.title } : x)))
      setError(e?.message ?? "Edit failed")
    } finally {
      setBusyId(null)
    }
  }

  function delWithUndo(task: Task) {
    if (busyId) return
    setError("")
    setMenuOpenId(null)

    // 先从 UI 移除
    setTasks((prev) => prev.filter((t) => t.id !== task.id))

    // 覆盖上一条 undo
    if (undo?.timer) clearTimeout(undo.timer)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" })
        if (!res.ok) throw new Error(await res.text())
      } catch (e: any) {
        setError(e?.message ?? "Delete failed")
        // 删除失败就恢复
        setTasks((prev) => [task, ...prev])
      } finally {
        setUndo(null)
      }
    }, 3000)

    setUndo({ task, timer })
  }

  async function clearDone() {
    if (busyId) return
    if (doneCount <= 0) return

    const ok = window.confirm(`清理已完成（${doneCount}）？`)
    if (!ok) return

    setError("")
    setBusyId("__bulk__")

    const snapshot = tasks
    setTasks((prev) => prev.filter((t) => !t.done))

    try {
      const res = await fetch("/api/tasks?done=true", { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
    } catch (e: any) {
      setTasks(snapshot)
      setError(e?.message ?? "Clear done failed")
    } finally {
      setBusyId(null)
    }
  }

  function openMenu(id: string) {
    setMenuOpenId((prev) => (prev === id ? null : id))
  }

  async function logout() {
    setUserMenuOpen(false)
    await signOut({ callbackUrl: "/" })
  }

  return (
    <main style={styles.bg}>
      <div style={styles.shell}>
        {/* Top bar */}
        <div style={styles.topBar}>
          {/* LEFT: keep Task Board */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 260 }}>
            <div style={styles.logoDot} />
            <div>
              <div style={styles.h1}>Task Board</div>
              <div style={styles.sub}>
                Remaining <b style={{ color: "white" }}>{remaining}</b> / {total}
              </div>
            </div>
          </div>

          {/* RIGHT: KPIs + search + refresh + user */}
          <div style={styles.topRight}>
            <div style={styles.kpi}>
              <div style={styles.kpiItem}>
                <div style={styles.kpiNum}>{total}</div>
                <div style={styles.kpiLbl}>Total</div>
              </div>
              <div style={styles.kpiSep} />
              <div style={styles.kpiItem}>
                <div style={styles.kpiNum}>{remaining}</div>
                <div style={styles.kpiLbl}>Active</div>
              </div>
              <div style={styles.kpiSep} />
              <div style={styles.kpiItem}>
                <div style={styles.kpiNum}>{doneCount}</div>
                <div style={styles.kpiLbl}>Done</div>
              </div>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks..."
              style={styles.search}
            />

            <button
              onClick={refresh}
              disabled={loading || !!busyId}
              style={{ ...styles.btnGhost, opacity: loading || busyId ? 0.55 : 1 }}
              title="Refresh"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>

            {/* User pill + menu */}
            <div ref={userMenuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                style={{
                  ...styles.userPill,
                  opacity: busyId ? 0.8 : 1,
                }}
                disabled={!!busyId}
                title={authed ? `${userName}${userEmail ? ` · ${userEmail}` : ""}` : "Not signed in"}
              >
                <span style={styles.avatar}>
                  {userImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={userImage} alt="avatar" style={styles.avatarImg as any} />
                  ) : (
                    <span style={styles.avatarTxt}>{getInitials(userName)}</span>
                  )}
                </span>

                <span style={{ display: "grid", gap: 2, textAlign: "left", minWidth: 0 }}>
                  <span style={styles.userName}>{authed ? userName : "Guest"}</span>
                  <span style={styles.userMeta}>{authed ? (userEmail || "Signed in") : "Not signed in"}</span>
                </span>

                <span style={styles.chev}>▾</span>
              </button>

              {userMenuOpen && (
                <div style={styles.userMenu}>
                  <div style={styles.userMenuHead}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ ...styles.avatar, width: 38, height: 38 }}>
                        {userImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={userImage} alt="avatar" style={styles.avatarImg as any} />
                        ) : (
                          <span style={styles.avatarTxt}>{getInitials(userName)}</span>
                        )}
                      </span>
                      <div style={{ display: "grid" }}>
                        <div style={{ fontWeight: 950, color: "rgba(255,255,255,0.95)" }}>
                          {authed ? userName : "Guest"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                          {authed ? userEmail || "Signed in" : "Sign in to sync"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={styles.userMenuBody}>
                    <button
                      style={{ ...styles.userMenuItem, opacity: authed ? 1 : 0.6 }}
                      onClick={logout}
                      disabled={!authed}
                    >
                      ⎋ Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div style={styles.panel}>
          {/* Composer */}
          <div style={styles.panelHead}>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  // 中文输入法：避免拼音上屏时 Enter 误提交
                  // @ts-ignore
                  if (e.nativeEvent?.isComposing) return
                  if (e.key === "Enter") add()
                }}
                placeholder="Add a task… (Enter to add)"
                disabled={adding || !!busyId}
                style={styles.input}
              />

              <button
                onClick={add}
                disabled={adding || !!busyId || !title.trim()}
                style={{
                  ...styles.btnPrimary,
                  opacity: adding || busyId || !title.trim() ? 0.55 : 1,
                }}
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </div>

            <div style={styles.panelTools}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Chip active={filter === "all"} onClick={() => setFilter("all")} label={`All (${total})`} />
                <Chip active={filter === "active"} onClick={() => setFilter("active")} label={`Active (${remaining})`} />
                <Chip active={filter === "done"} onClick={() => setFilter("done")} label={`Done (${doneCount})`} />
              </div>

              <button
                onClick={clearDone}
                disabled={!!busyId || doneCount === 0}
                style={{
                  ...styles.btnOk,
                  opacity: busyId || doneCount === 0 ? 0.55 : 1,
                }}
              >
                Clear done
              </button>
            </div>

            {error && <div style={styles.alert}>{error}</div>}
          </div>

          {/* Grid */}
          <div style={styles.panelBody}>
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={styles.skeleton} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={styles.emptyBox}>
                <div style={{ fontWeight: 950, fontSize: 16 }}>No tasks</div>
                <div style={{ marginTop: 6, color: "rgba(255,255,255,0.68)" }}>
                  Add one above. Tip: Enter to add, double click to edit.
                </div>
              </div>
            ) : (
              <div style={styles.grid}>
                {filtered.map((t) => {
                  const busy = busyId === t.id || busyId === "__bulk__"
                  const editing = editingId === t.id
                  const menuOpen = menuOpenId === t.id

                  return (
                    <div key={t.id} className="task-card" style={{ ...styles.card, opacity: busy ? 0.75 : 1 }}>
                      <div style={styles.cardTop}>
                        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={t.done}
                            disabled={!!busyId}
                            onChange={() => toggle(t.id, t.done)}
                            style={{ width: 18, height: 18 }}
                          />
                          <span style={styles.badge}>{t.done ? "Done" : "Active"}</span>
                        </label>

                        <div style={{ position: "relative" }}>
                          <button
                            className="more-btn"
                            onClick={() => openMenu(t.id)}
                            disabled={!!busyId}
                            style={{ ...styles.iconBtnNeutral, opacity: busyId ? 0.55 : 1 }}
                            title="More"
                            aria-label="More"
                          >
                            ⋯
                          </button>

                          {menuOpen && (
                            <div ref={menuRef} style={styles.menu}>
                              <button style={styles.menuItem} onClick={() => startEdit(t)} disabled={!!busyId}>
                                ✏️ Edit
                              </button>
                              <button
                                style={{ ...styles.menuItem, ...styles.menuDanger }}
                                onClick={() => delWithUndo(t)}
                                disabled={!!busyId}
                              >
                                🗑 Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        {!editing ? (
                          <div
                            onDoubleClick={() => startEdit(t)}
                            style={{
                              ...styles.cardTitle,
                              color: t.done ? "rgba(255,255,255,0.55)" : "white",
                              textDecoration: t.done ? "line-through" : "none",
                              cursor: busyId ? "default" : "text",
                            }}
                            title="Double click to edit"
                          >
                            {t.title}
                          </div>
                        ) : (
                          <div>
                            <textarea
                              ref={editRef}
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") cancelEdit()
                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveEdit(t.id)
                              }}
                              disabled={!!busyId}
                              style={styles.textarea}
                            />
                            <div style={styles.editBar}>
                              <button
                                onClick={() => saveEdit(t.id)}
                                disabled={!!busyId}
                                style={{ ...styles.btnMiniPrimary, opacity: busyId ? 0.55 : 1 }}
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={!!busyId}
                                style={{ ...styles.btnMiniGhost, opacity: busyId ? 0.55 : 1 }}
                              >
                                Cancel
                              </button>
                              <span style={styles.hint}>Ctrl/⌘ + Enter 保存，Esc 取消</span>
                            </div>
                          </div>
                        )}

                        <div style={styles.time}>{formatTime(t.createdAt)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div style={styles.footerHint}>Tips：双击任务编辑；Ctrl + Enter 保存；Esc 取消。</div>

        {/* Undo bar */}
        {undo && (
          <div style={styles.undoBar}>
            <span style={{ fontWeight: 900 }}>Deleted</span>
            <button
              onClick={() => {
                clearTimeout(undo.timer)
                setTasks((prev) => [undo.task, ...prev])
                setUndo(null)
              }}
              style={styles.undoBtn}
            >
              Undo
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% {
            background-position: 0% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        .task-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 26px 90px rgba(0, 0, 0, 0.55);
        }

        .task-card {
          transition: transform 120ms ease, box-shadow 120ms ease;
          will-change: transform, box-shadow;
        }

        .more-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </main>
  )
}

function Chip(props: { active: boolean; label: string; onClick: () => void }) {
  const { active, label, onClick } = props
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: active ? "rgba(99,102,241,0.32)" : "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.92)",
        fontSize: 13,
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% 10%, rgba(99,102,241,0.20), transparent 60%), radial-gradient(900px 500px at 80% 30%, rgba(16,185,129,0.16), transparent 55%), linear-gradient(#0b1020, #070a12)",
    color: "white",
  },
  shell: { maxWidth: 1180, margin: "0 auto", padding: "44px 16px 70px" },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  logoDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    background: "rgba(99,102,241,0.95)",
    boxShadow: "0 0 0 6px rgba(99,102,241,0.12), 0 12px 28px rgba(99,102,241,0.20)",
  },
  h1: { fontSize: 40, fontWeight: 950, letterSpacing: -0.7 },
  sub: { marginTop: 6, color: "rgba(255,255,255,0.68)" },

  topRight: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "nowrap",
    minWidth: 320,
  },
  kpi: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
  },
  kpiItem: { display: "grid", justifyItems: "center", minWidth: 56 },
  kpiNum: { fontSize: 18, fontWeight: 950, letterSpacing: -0.2 },
  kpiLbl: { fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 800 },
  kpiSep: { width: 1, height: 28, background: "rgba(255,255,255,0.10)" },

  search: {
    width: "auto",
    maxWidth: "78vw",
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
  },

  btnGhost: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },

  // NEW: user pill
  userPill: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    cursor: "pointer",
    color: "white",

    width: 260,          // 关键：固定宽度（或 maxWidth + minWidth）
    flex: "0 0 auto",    // 关键：不让它参与挤压/伸缩
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(99,102,241,0.18)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    flex: "0 0 auto",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  avatarTxt: { fontWeight: 950, color: "rgba(255,255,255,0.92)" },

  userName: {
    fontWeight: 950,
    fontSize: 13,
    color: "rgba(255,255,255,0.94)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  userMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.62)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  chev: { marginLeft: 6, color: "rgba(255,255,255,0.6)", fontWeight: 950 },

  userMenu: {
    position: "absolute",
    right: 0,
    top: 52,
    width: 260,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(10,12,20,0.92)",
    boxShadow: "0 22px 80px rgba(0,0,0,0.55)",
    overflow: "hidden",
    zIndex: 80,
    backdropFilter: "blur(10px)",
  },
  userMenuHead: {
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(99,102,241,0.16), rgba(0,0,0,0.0))",
  },
  userMenuBody: { padding: 8 },
  userMenuItem: {
    width: "100%",
    textAlign: "left",
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 950,
  },

  panel: {
    marginTop: 14,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 22px 90px rgba(0,0,0,0.50)",
    overflow: "hidden",
  },
  panelHead: { padding: 16, borderBottom: "1px solid rgba(255,255,255,0.10)" },
  input: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.26)",
    color: "white",
    outline: "none",
  },
  btnPrimary: {
    padding: "12px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(99,102,241,0.95)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 14px 40px rgba(99,102,241,0.22)",
  },
  panelTools: {
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  btnOk: {
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(16,185,129,0.18)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },
  alert: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.10)",
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
  },

  panelBody: { padding: 14 },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 },

  card: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.18))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    padding: 14,
    transition: "transform 120ms ease, box-shadow 120ms ease",
    willChange: "transform, box-shadow",
  },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  badge: {
    display: "inline-flex",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: 900,
  },

  iconBtnNeutral: {
    width: 36,
    height: 36,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    lineHeight: "36px",
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: 950,
    lineHeight: 1.3,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    minHeight: 64,
  },
  time: { marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.55)" },

  textarea: {
    width: "100%",
    minHeight: 96,
    resize: "vertical",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.26)",
    color: "white",
    padding: 12,
    outline: "none",
    lineHeight: 1.5,
  },
  editBar: { marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  btnMiniPrimary: {
    padding: "9px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(99,102,241,0.30)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 950,
  },
  btnMiniGhost: {
    padding: "9px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.90)",
    cursor: "pointer",
    fontWeight: 950,
  },
  hint: { fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700 },

  footerHint: { marginTop: 14, color: "rgba(255,255,255,0.55)", fontSize: 12 },

  emptyBox: {
    padding: 18,
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.80)",
    background: "rgba(0,0,0,0.14)",
  },

  skeleton: {
    height: 150,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.10), rgba(255,255,255,0.05))",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.2s infinite",
  },

  menu: {
    position: "absolute",
    right: 0,
    top: 42,
    width: 170,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(10,12,20,0.92)",
    boxShadow: "0 22px 80px rgba(0,0,0,0.55)",
    overflow: "hidden",
    zIndex: 50,
    backdropFilter: "blur(10px)",
  },
  menuItem: {
    width: "100%",
    textAlign: "left",
    padding: "11px 12px",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  menuDanger: {
    color: "rgba(255,255,255,0.95)",
    background: "linear-gradient(90deg, rgba(239,68,68,0.18), transparent)",
  },

  undoBar: {
    position: "fixed",
    left: "50%",
    bottom: 18,
    transform: "translateX(-50%)",
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.55)",
    color: "white",
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
    zIndex: 9999,
  },
  undoBtn: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(99,102,241,0.35)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  },
}
