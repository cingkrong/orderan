import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const EXPENSE_CATEGORIES = [
  "ads",
  "operational",
  "salary",
  "rent",
  "packaging",
  "other",
] as const;

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  ads: "Iklan",
  operational: "Operasional",
  salary: "Gaji",
  rent: "Sewa",
  packaging: "Packing",
  other: "Lainnya",
};

const expenseInput = z.object({
  id: z.string().uuid().optional(),
  date: z.string().min(1),
  category: z.enum(EXPENSE_CATEGORIES),
  subcategory: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  amount: z.number().min(0),
  note: z.string().nullable().optional(),
});

export type ExpenseInput = z.infer<typeof expenseInput>;

export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        category: z.enum(EXPENSE_CATEGORIES).nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("expenses").select("*").order("date", { ascending: false });
    if (data.from) q = q.gte("date", data.from);
    if (data.to) q = q.lte("date", data.to);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("expenses")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Expense not found");
    return row;
  });

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => expenseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const payload = {
      ...rest,
      subcategory: rest.subcategory || null,
      source: rest.source || null,
      note: rest.note || null,
    };
    if (id) {
      const { error } = await context.supabase.from("expenses").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: inserted, error } = await context.supabase
      .from("expenses")
      .insert({ ...payload, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
