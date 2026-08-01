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
          height: is100x100 ? 28 : 36,
          margin: 0,
          width: is100x100 ? 1.25 : 1.45,
        });
      } catch {
        /* ignore */
      }
    }
    if (qrRef.current) {
      QRCode.toCanvas(qrRef.current, data.order_number, {
        width: is100x100 ? 42 : 48,
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

  const serviceName = (data.service || (isCustom ? "CUSTOM" : "EZ")).toUpperCase();

  // Weight formatting
  const weightKg = (data.weight_g || 1000) / 1000;
  const weightStr = weightKg >= 1 ? `${weightKg % 1 === 0 ? weightKg : weightKg.toFixed(1)} KG` : `${Math.round(data.weight_g)} G`;

  // Sender info
  const senderName = data.is_dropship ? (data.dropship_name || data.sender.name) : data.sender.name;
  const senderPhone = data.is_dropship ? (data.dropship_phone || data.sender.phone) : data.sender.phone;
  const senderCity = data.sender.city ? (data.sender.city.startsWith("Kota") || data.sender.city.startsWith("Kab") ? data.sender.city : `Kota ${data.sender.city}`) : "Kota Surakarta";

  // Sorting code
  const sortingCode = data.routing_code || `${data.postal_code || '550'}-${data.order_number.slice(-8).toUpperCase()}`;

  return (
    <div
      className={`label-page bg-white text-black border border-gray-400 select-none ${is100x100 ? 'size-100x100' : 'size-100x150'}`}
      style={{
        width: "100mm",
        height: is100x100 ? "100mm" : "150mm",
        padding: "3.5mm 4.5mm",
        fontFamily: "'Segoe UI', Roboto, Arial, sans-serif",
        boxSizing: "border-box",
        overflow: "hidden",
        color: "#000",
      }}
    >
      {/* Compact natural height container (not stretched full page) */}
      <div className="flex flex-col w-full text-black">
        {/* HEADER: STORE LOGO */}
        <div className="border-b border-gray-300 pb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {data.sender.logo_url ? (
              <img
                src={data.sender.logo_url}
                alt="Logo"
                style={{ height: "6mm", maxWidth: "38mm", objectFit: "contain" }}
              />
            ) : (
              <div className="flex items-center gap-1 font-bold tracking-tight text-red-600" style={{ fontSize: "13pt" }}>
                <span className="text-[11pt]">🛒</span>
                <span className="text-[#c62828] font-extrabold uppercase">{data.sender.name || "MAULARIS"}</span>
              </div>
            )}
          </div>
        </div>

        {/* COURIER & BARCODE ROW */}
        <div className="grid grid-cols-12 border-b border-gray-300 py-1.5 items-center">
          {/* Left Column: Courier Logo & Service Box */}
          <div className="col-span-4 pr-2 border-r border-gray-300 flex flex-col items-center justify-center">
            <div className="font-extrabold italic text-center leading-none" style={{ fontSize: "12pt", fontFamily: "Arial, sans-serif" }}>
              {courierBrand === "J&T EXPRESS" ? (
                <span><span className="text-black italic font-black">J&T</span><span className="text-[8pt] font-semibold not-italic block tracking-tighter">EXPRESS</span></span>
              ) : (
                courierBrand
              )}
            </div>
            <div className="mt-1 border border-black px-3 py-0.5 font-semibold text-center text-[8.5pt] leading-none min-w-[18mm]">
              {serviceName}
            </div>
          </div>

          {/* Right Column: Barcode & Resi No */}
          <div className="col-span-8 pl-2 flex flex-col items-center justify-center">
            <svg ref={barcodeRef} className="w-full max-w-[54mm]" />
            <div className="font-sans text-center mt-0.5 text-[8.5pt]">
              No. Resi: <span className="font-bold">{code}</span>
            </div>
          </div>
        </div>

        {/* PENGIRIM & PENERIMA ROW */}
        <div className="grid grid-cols-2 border-b border-gray-300 py-1.5 text-[8pt] leading-tight">
          {/* Pengirim */}
          <div className="pr-2 border-r border-gray-300">
            <div className="text-[7pt] font-normal text-gray-700 uppercase tracking-wide">
              PENGIRIM: {data.is_dropship && <span className="text-black font-bold">[DROPSHIP]</span>}
            </div>
            <div className="font-bold text-[8.5pt] mt-0.5 truncate">{senderName}</div>
            <div className="text-gray-900">{senderPhone}</div>
            <div className="text-gray-900 truncate">{senderCity}</div>
          </div>

          {/* Penerima */}
          <div className="pl-2">
            <div className="text-[7pt] font-normal text-gray-700 uppercase tracking-wide">PENERIMA:</div>
            <div className="font-bold text-[8.5pt] mt-0.5 truncate">{data.customer_name}</div>
            <div className="text-gray-900">{data.phone}</div>
            <div className={`line-clamp-${is100x100 ? '2' : '3'} text-[7.5pt] text-gray-900 leading-snug mt-0.5`}>
              {data.full_address}
              {data.city ? `, ${data.city}` : ""}
              {data.postal_code ? `, ${data.postal_code}` : ""}
            </div>
          </div>
        </div>

        {/* ISI PAKET & JUMLAH TABLE */}
        <div className="border-b border-gray-300 py-1.5 text-[8pt]">
          <div className="flex justify-between font-normal text-[7.5pt] text-gray-900 mb-0.5">
            <span>Isi Paket</span>
            <span>Jumlah</span>
          </div>
          <div className="space-y-0.5">
            {data.items.slice(0, is100x100 ? 2 : 3).map((it, idx) => (
              <div key={idx} className="flex justify-between items-center text-[8pt]">
                <span className="truncate pr-2 font-normal text-gray-900">{it.name}{it.variant ? ` (${it.variant})` : ""}</span>
                <span className="font-normal text-right pl-1">{it.qty}</span>
              </div>
            ))}
            {data.items.length > (is100x100 ? 2 : 3) && (
              <div className="text-[7pt] italic text-gray-600">
                +{data.items.length - (is100x100 ? 2 : 3)} barang lainnya
              </div>
            )}
          </div>
        </div>

        {/* BERAT, ASURANSI, CATATAN & ORDER QR */}
        <div className="grid grid-cols-12 border-b border-gray-300 py-1.5 items-center text-[8pt]">
          {/* Left Column: Weight, Insurance, Note */}
          <div className="col-span-7 pr-2 border-r border-gray-300 space-y-0.5">
            <div>
              BERAT: <span className="font-bold">{weightStr}</span> &nbsp;&nbsp;&nbsp; ASURANSI: <span className="font-bold">{data.insurance ? "Ya" : "No"}</span>
            </div>
            <div className="truncate">
              CATATAN: <span className="font-normal">{data.note || "-"}</span>
            </div>
          </div>

          {/* Right Column: Order No & QR Code */}
          <div className="col-span-5 pl-2 flex items-center justify-between">
            <div>
              <div className="text-[7.5pt] text-gray-900 font-normal">No Order:</div>
              <div className="font-sans font-bold text-[8pt] tracking-tight truncate max-w-[28mm]">
                {data.order_number}
              </div>
            </div>
            <canvas ref={qrRef} className="shrink-0" />
          </div>
        </div>

        {/* BOTTOM SORTING CODE */}
        <div className="pt-2 pb-1 text-center font-bold tracking-normal text-black leading-none" style={{ fontSize: is100x100 ? "13pt" : "16pt" }}>
          {sortingCode}
        </div>
      </div>
    </div>
  );
}
