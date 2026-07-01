import { createFileRoute } from "@tanstack/react-router";
import { OrderForm } from "./orders.new";

export const Route = createFileRoute("/_authenticated/orders_/$id/edit")({
  component: EditOrderPage,
});

function EditOrderPage() {
  const { id } = Route.useParams();
  return <OrderForm existingId={id} />;
}
