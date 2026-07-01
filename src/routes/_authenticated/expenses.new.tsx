import { createFileRoute } from "@tanstack/react-router";
import { ExpenseForm } from "@/components/expense-form";

export const Route = createFileRoute("/_authenticated/expenses/new")({
  component: () => <ExpenseForm />,
});
