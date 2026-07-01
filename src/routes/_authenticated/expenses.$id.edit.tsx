import { createFileRoute } from "@tanstack/react-router";
import { ExpenseForm } from "@/components/expense-form";

export const Route = createFileRoute("/_authenticated/expenses/$id/edit")({
  component: EditExpensePage,
});

function EditExpensePage() {
  const { id } = Route.useParams();
  return <ExpenseForm id={id} />;
}
