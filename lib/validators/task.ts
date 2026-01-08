export const TASK_TITLE_MIN = 1
export const TASK_TITLE_MAX = 120

export function validateTaskTitle(input: unknown) {
  const title = String(input ?? "").trim()
  if (title.length < TASK_TITLE_MIN) return { ok: false as const, error: "Title is required" }
  if (title.length > TASK_TITLE_MAX) return { ok: false as const, error: `Title too long (max ${TASK_TITLE_MAX})` }
  return { ok: true as const, value: title }
}
