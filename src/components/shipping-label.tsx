import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export type LabelData = {
  order_number: string;
  customer_name: string;
  phone: string;
  full_address: string;
  city?: string | null;
  postal_code?: string | null;
  courier?: string | null;
  service?: string | null;
  tracking_number?: string | null;
  weight_g: number;
  shipping_cost?: number | null;
  insurance: boolean;
  routing_code?: string | null;
  note?: string | null;
  items: Array<{ name: string; variant?: string | null; qty: number }>;
  is_dropship?: boolean;
  dropship_name?: string | null;
  dropship_phone?: string | null;
  sender: {
    name: string;
    phone: string;
    city: string;
    address?: string;
    logo_url?: string | null;
  };
};

export function ShippingLabel({ data }: { data: LabelData }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const code = data.tracking_number?.trim() || data.order_number;

  useEffect(() => {
    if (barcodeRef.current && code) {
      try {
        JsBarcode(barcodeRef.current, code, {
          format: "CODE128",
          displayValue: false,
          height: 50,
          margin: 0,
          width: 1.6,
        });
      } catch {
        /* ignore */
      }
    }
    if (qrRef.current) {
      QRCode.toCanvas(qrRef.current, data.order_number, { width: 70, margin: 0 }).catch(() => {});
    }
  }, [code, data.order_number]);

  const isCustom = (data.courier ?? "").toLowerCase() === "custom";
  const courierLine = isCustom
    ? (data.service || "—")
    : [data.courier?.toUpperCase(), data.service].filter(Boolean).join(" ");


  return (
    <div
      className="label-page bg-white text-black border border-black/20 shadow-sm flex flex-col"
      style={{ width: "100mm", height: "150mm", padding: "3mm", fontFamily: "Arial, sans-serif", fontSize: "9pt" }}
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-1.5">
        <div className="flex items-center gap-1.5">
          {data.sender.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.sender.logo_url} alt="logo" style={{ height: "10mm", maxWidth: "20mm", objectFit: "contain" }} />
          ) : (
            <div className="font-extrabold" style={{ fontSize: "11pt" }}>{data.sender.name || "OMS"}</div>
          )}
        </div>
        <div className="text-right">
          <div className="font-bold" style={{ fontSize: "12pt", lineHeight: 1 }}>{courierLine || "—"}</div>
          {typeof data.shipping_cost === "number" && data.shipping_cost > 0 && (
            <div className="font-bold" style={{ fontSize: "9pt" }}>
              Ongkir: {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(data.shipping_cost)}
            </div>
          )}
          {data.insurance && (
            <div className="mt-0.5 inline-block border border-black px-1 text-[8pt] font-semibold">ASURANSI</div>
          )}
        </div>
      </div>

      {/* Barcode */}
      <div className="flex flex-col items-center py-1 border-b border-black">
        <svg ref={barcodeRef} style={{ width: "85mm", height: "13mm" }} />
        <div className="font-mono font-bold tracking-wider" style={{ fontSize: "10pt" }}>{code}</div>
      </div>

      {/* Routing code */}
      {data.routing_code && (
        <div className="text-center font-bold border-b border-black py-1" style={{ fontSize: "16pt", letterSpacing: "2px" }}>
          {data.routing_code}
        </div>
      )}

      {/* Sender / Receiver */}
      <div className="border-b border-black py-1">
        <div className="text-[7pt] font-bold uppercase text-black/70 flex items-center gap-1">
          Pengirim
          {data.is_dropship && (
            <span className="border border-black px-1 text-[7pt] font-bold">DROPSHIP</span>
          )}
        </div>
        <div className="font-semibold leading-tight">
          {data.is_dropship ? (data.dropship_name || data.sender.name) : data.sender.name}
        </div>
        <div className="leading-tight">
          {(data.is_dropship ? (data.dropship_phone || data.sender.phone) : data.sender.phone)} · {data.sender.city}
        </div>
      </div>
      <div className="border-b-2 border-black py-1">
        <div className="text-[7pt] font-bold uppercase text-black/70">Penerima</div>
        <div className="font-bold leading-tight" style={{ fontSize: "11pt" }}>{data.customer_name}</div>
        <div className="leading-tight font-semibold">{data.phone}</div>
        <div className="leading-snug mt-0.5" style={{ fontSize: "9pt" }}>
          {data.full_address}
          {data.city ? `, ${data.city}` : ""}
          {data.postal_code ? ` ${data.postal_code}` : ""}
        </div>
      </div>

      {/* Items */}
      <div className="py-1 border-b border-black">
        <div className="text-[7pt] font-bold uppercase text-black/70">Isi Paket · {Math.round(data.weight_g)} g</div>
        <ul className="leading-tight">
          {data.items.slice(0, 4).map((it, i) => (
            <li key={i} className="truncate">
              {it.qty}× {it.name}{it.variant ? ` (${it.variant})` : ""}
            </li>
          ))}
          {data.items.length > 4 && <li className="italic">+{data.items.length - 4} lainnya</li>}
        </ul>
      </div>

      {/* Footer */}
      <div className="pt-1 flex justify-between items-end">
        <div>
          <div className="text-[7pt] uppercase text-black/70">No. Pesanan</div>
          <div className="font-mono font-bold" style={{ fontSize: "9pt" }}>{data.order_number}</div>
          {data.note && (
            <div className="text-[7pt] mt-0.5 max-w-[55mm] line-clamp-2">Catatan: {data.note}</div>
          )}
        </div>
        <canvas ref={qrRef} />
      </div>
    </div>
  );
}
