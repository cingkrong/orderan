import { createFileRoute } from "@tanstack/react-router";
import { ProductForm } from "@/components/product-form";
import { StockAdjustCard } from "@/components/stock-adjust-card";
import { StockHistoryCard } from "@/components/history-cards";

export const Route = createFileRoute("/_authenticated/products/$id/edit")({
  component: EditProductPage,
});

function EditProductPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-6">
      <ProductForm id={id} />
      <div className="max-w-6xl mx-auto w-full space-y-4 px-4 md:px-6 pb-8">
        <StockAdjustCard productId={id} />
        <StockHistoryCard productId={id} />
      </div>
    </div>
  );
}
