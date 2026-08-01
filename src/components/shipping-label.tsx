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

interface ShippingLabelProps {
  data: LabelData;
  paperSize?: "100x100" | "100x150";
}

export function ShippingLabel({ data, paperSize = "100x150" }: ShippingLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const code = data.tracking_number?.trim() || data.order_number;

  const is100x100 = paperSize === "100x100";

  useEffect(() => {
    if (barcodeRef.current && code) {
      try {
        JsBarcode(barcodeRef.current, code, {
          format: "CODE128",
          displayValue: false,
          height: is100x100 ? 32 : 44,
          margin: 0,
          width: is100x100 ? 1.3 : 1.6,
        });
      } catch {
        /* ignore */
      }
    }
    if (qrRef.current) {
      QRCode.toCanvas(qrRef.current, data.order_number, {
        width: is100x100 ? 45 : 55,
        margin: 0,
      }).catch(() => {});
    }
  }, [code, data.order_number, is100x100]);

  const rawCourier = (data.courier ?? "").toLowerCase();
  const isCustom = rawCourier === "custom";

  // Courier brand name display
  let courierBrand = (data.courier || "EXPRESS").toUpperCase();
  if (courierBrand === "JNT" || courierBrand.includes("J&T")) courierBrand = "J&T EXPRESS";
  else if (courierBrand === "JNE") courierBrand = "JNE EXPRESS";
  else if (courierBrand === "SICEPAT") courierBrand = "SiCepat";
  else if (courierBrand === "NINJA") courierBrand = "Ninja Express";
  else if (courierBrand === "SAP") courierBrand = "SAPX";
  else if (courierBrand === "IDE") courierBrand = "IDexpress";
  else if (courierBrand === "ANTERAJA") courierBrand = "AnterAja";

  const serviceName = (data.service || (isCustom ? "CUSTOM" : "REG")).toUpperCase();

  // Weight formatting
  const weightKg = (data.weight_g || 1000) / 1000;
  const weightStr = weightKg >= 1 ? `${weightKg % 1 === 0 ? weightKg : weightKg.toFixed(1)} KG` : `${Math.round(data.weight_g)} G`;

  // Sender info
  const senderName = data.is_dropship ? (data.dropship_name || data.sender.name) : data.sender.name;
  const senderPhone = data.is_dropship ? (data.dropship_phone || data.sender.phone) : data.sender.phone;
  const senderCity = data.sender.city ? (data.sender.city.startsWith("Kota") || data.sender.city.startsWith("Kab") ? data.sender.city : `Kota ${data.sender.city}`) : "Kota Surakarta";

  // Routing / Sorting code
  const sortingCode = data.routing_code || `${data.postal_code || '550'}-${data.order_number.slice(-8).toUpperCase()}`;

  return (
    <div
      className={`label-page bg-white text-black border border-black flex flex-col justify-between select-none ${is100x100 ? 'size-100x100' : 'size-100x150'}`}
      style={{
        width: "100mm",
        height: is100x100 ? "100mm" : "150mm",
        padding: is100x100 ? "2mm" : "3mm",
        fontFamily: "Arial, Helvetica, sans-serif",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div className="flex flex-col h-full justify-between">
        {/* SECTION 1: STORE HEADER */}
        <div className="flex items-center justify-between border-b-2 border-black pb-1">
          <div className="flex items-center gap-1.5">
            {data.sender.logo_url ? (
              <img
                src={data.sender.logo_url}
                alt="Logo"
                style={{ height: is100x100 ? "6mm" : "8mm", maxWidth: "35mm", objectFit: "contain" }}
              />
            ) : (
              <div className="flex items-center gap-1 font-black tracking-tight text-red-600" style={{ fontSize: is100x100 ? "11pt" : "13pt" }}>
                <span>🛒</span>
                <span className="text-black uppercase">{data.sender.name || "MAULARIS"}</span>
              </div>
            )}
          </div>
          {typeof data.shipping_cost === "number" && data.shipping_cost > 0 && (
            <div className="text-right font-bold text-[8pt]">
              {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(data.shipping_cost)}
            </div>
          )}
        </div>

        {/* SECTION 2: COURIER LOGO & BARCODE */}
        <div className="grid grid-cols-12 border-b border-black py-1 items-center">
          {/* Left: Courier & Service */}
          <div className="col-span-5 flex flex-col items-center justify-center pr-1 border-r border-black text-center">
            <div className="font-black italic tracking-tighter uppercase leading-none" style={{ fontSize: is100x100 ? "11pt" : "13pt" }}>
              {courierBrand}
            </div>
            <div
              className="mt-1 px-3 py-0.5 border border-black font-bold uppercase tracking-wider text-center"
              style={{ fontSize: is100x100 ? "8pt" : "9.5pt", minWidth: "18mm" }}
            >
              {serviceName}
            </div>
          </div>

          {/* Right: Barcode + Resi Number */}
          <div className="col-span-7 flex flex-col items-center justify-center pl-1">
            <svg ref={barcodeRef} className="w-full max-w-[55mm]" />
            <div className="font-mono font-bold tracking-tight text-center mt-0.5" style={{ fontSize: is100x100 ? "8pt" : "9.5pt" }}>
              No. Resi: <span className="font-extrabold">{code}</span>
            </div>
          </div>
        </div>

        {/* SECTION 3: SENDER & RECIPIENT */}
        <div className="grid grid-cols-2 border-b border-black py-1 text-[8pt] leading-tight">
          {/* Sender */}
          <div className="pr-1.5 border-r border-black">
            <div className="font-bold text-[7pt] text-gray-700 uppercase mb-0.5">
              PENGIRIM: {data.is_dropship && <span className="text-black font-black">[DROPSHIP]</span>}
            </div>
            <div className="font-bold text-[9pt] truncate">{senderName}</div>
            <div>{senderPhone}</div>
            <div className="truncate">{senderCity}</div>
          </div>

          {/* Recipient */}
          <div className="pl-1.5">
            <div className="font-bold text-[7pt] text-gray-700 uppercase mb-0.5">PENERIMA:</div>
            <div className="font-bold text-[9.5pt] leading-tight truncate">{data.customer_name}</div>
            <div className="font-semibold">{data.phone}</div>
            <div className={`line-clamp-${is100x100 ? '2' : '3'} text-[7.5pt] leading-snug mt-0.5 font-normal`}>
              {data.full_address}
              {data.city ? `, ${data.city}` : ""}
              {data.postal_code ? `, ${data.postal_code}` : ""}
            </div>
          </div>
        </div>

        {/* SECTION 4: ITEMS LIST */}
        <div className="border-b border-black py-1 text-[8pt]">
          <div className="flex justify-between font-bold text-[7.5pt] border-b border-gray-300 pb-0.5 mb-0.5">
            <span>Isi Paket</span>
            <span>Jumlah</span>
          </div>
          <div className="space-y-0.5">
            {data.items.slice(0, is100x100 ? 2 : 3).map((it, idx) => (
              <div key={idx} className="flex justify-between items-center text-[7.5pt] leading-tight">
                <span className="truncate pr-2">{it.name}{it.variant ? ` (${it.variant})` : ""}</span>
                <span className="font-bold text-right pl-1">{it.qty}</span>
              </div>
            ))}
            {data.items.length > (is100x100 ? 2 : 3) && (
              <div className="text-[7pt] italic text-gray-600">
                +{data.items.length - (is100x100 ? 2 : 3)} barang lainnya
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5: PACKAGE INFO & ORDER QR */}
        <div className="grid grid-cols-12 border-b border-black py-1 items-center text-[7.5pt]">
          {/* Left: Weight, Insurance, Notes */}
          <div className="col-span-7 pr-1 border-r border-black space-y-0.5">
            <div className="font-bold">
              BERAT: <span className="font-extrabold">{weightStr}</span> &nbsp;&nbsp; ASURANSI: <span className="font-bold">{data.insurance ? "Ya" : "No"}</span>
            </div>
            <div className="truncate">
              CATATAN: <span className="font-normal">{data.note || "-"}</span>
            </div>
          </div>

          {/* Right: Order Number & QR Code */}
          <div className="col-span-5 pl-1 flex items-center justify-between">
            <div className="pr-1">
              <div className="text-[6.5pt] text-gray-600 font-bold uppercase">No Order:</div>
              <div className="font-mono font-bold text-[8pt] tracking-tighter truncate max-w-[28mm]">
                {data.order_number}
              </div>
            </div>
            <canvas ref={qrRef} className="shrink-0" />
          </div>
        </div>

        {/* SECTION 6: BOTTOM ROUTING / SORTING CODE */}
        <div className="pt-1 text-center font-black tracking-wider uppercase leading-none" style={{ fontSize: is100x100 ? "14pt" : "18pt" }}>
          {sortingCode}
        </div>
      </div>
    </div>
  );
}
