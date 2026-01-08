import { z } from "zod"

export const TaskCreateSchema = z.object({
  title: z.string().trim().min(1, "title required").max(120, "title too long"),
})

export const TaskPatchSchema = z.object({
  title: z.string().trim().min(1, "title required").max(120, "title too long").optional(),
  done: z.boolean().optional(),
}).refine((v) => v.title !== undefined || v.done !== undefined, { message: "no fields to update" })
