import React, { useState } from "react";
import { cn } from "@/lib/utils";

export type CourierCode =
  | "jne"
  | "jnt"
  | "jnt_cargo"
  | "sicepat"
  | "ninja"
  | "sap"
  | "anteraja"
  | "lion"
  | "ide"
  | "idx"
  | "idexpress"
  | "paxel"
  | "spx"
  | "lalamove"
  | "grab"
  | "pos"
  | "wahana"
  | "tiki"
  | string;

export const COURIER_LOGOS: Record<
  string,
  { name: string; logoUrl: string; bgColor: string; textColor: string }
> = {
  jne: {
    name: "JNE Express",
    logoUrl: "https://assets.lincah.id/images/logo/jne.png",
    bgColor: "#003399",
    textColor: "#ffffff",
  },
  jnt: {
    name: "J&T Express",
    logoUrl: "https://assets.lincah.id/images/logo/jnt.png",
    bgColor: "#e30613",
    textColor: "#ffffff",
  },
  jnt_cargo: {
    name: "J&T Cargo",
    logoUrl: "https://assets.lincah.id/images/logo/jnt_cargo.png",
    bgColor: "#e30613",
    textColor: "#ffffff",
  },
  sicepat: {
    name: "SiCepat Express",
    logoUrl: "https://assets.lincah.id/images/logo/sicepat.png",
    bgColor: "#ed1c24",
    textColor: "#ffffff",
  },
  ninja: {
    name: "Ninja Express",
    logoUrl: "https://assets.lincah.id/images/logo/ninja.png",
    bgColor: "#c8102e",
    textColor: "#ffffff",
  },
  sap: {
    name: "SAP Express",
    logoUrl: "https://assets.lincah.id/images/logo/sap.png",
    bgColor: "#0047ba",
    textColor: "#ffffff",
  },
  anteraja: {
    name: "AnterAja",
    logoUrl: "https://assets.lincah.id/images/logo/anteraja.png",
    bgColor: "#ed1941",
    textColor: "#ffffff",
  },
  lion: {
    name: "Lion Parcel",
    logoUrl: "https://assets.lincah.id/images/logo/lion.png",
    bgColor: "#ed1b24",
    textColor: "#ffffff",
  },
  ide: {
    name: "ID Express",
    logoUrl: "https://assets.lincah.id/images/logo/idx.png",
    bgColor: "#e60012",
    textColor: "#ffffff",
  },
  idx: {
    name: "ID Express",
    logoUrl: "https://assets.lincah.id/images/logo/idx.png",
    bgColor: "#e60012",
    textColor: "#ffffff",
  },
  idexpress: {
    name: "ID Express",
    logoUrl: "https://assets.lincah.id/images/logo/idx.png",
    bgColor: "#e60012",
    textColor: "#ffffff",
  },
  paxel: {
    name: "Paxel",
    logoUrl: "https://assets.lincah.id/images/logo/paxel.png",
    bgColor: "#5a2d82",
    textColor: "#ffffff",
  },
  spx: {
    name: "SPX Express",
    logoUrl: "https://assets.lincah.id/images/logo/spx-express.png",
    bgColor: "#ee4d2d",
    textColor: "#ffffff",
  },
  lalamove: {
    name: "Lalamove",
    logoUrl: "https://assets.lincah.id/images/logo/lalamove.png",
    bgColor: "#ff6600",
    textColor: "#ffffff",
  },
  grab: {
    name: "Grab",
    logoUrl: "https://assets.lincah.id/images/logo/grab.png",
    bgColor: "#00b14f",
    textColor: "#ffffff",
  },
  pos: {
    name: "Pos Indonesia",
    logoUrl: "https://assets.lincah.id/images/logo/pos.png",
    bgColor: "#ff6600",
    textColor: "#ffffff",
  },
  wahana: {
    name: "Wahana Express",
    logoUrl: "https://assets.lincah.id/images/logo/wahana.png",
    bgColor: "#005baa",
    textColor: "#ffffff",
  },
  tiki: {
    name: "TIKI",
    logoUrl: "https://assets.lincah.id/images/logo/tiki.png",
    bgColor: "#003087",
    textColor: "#ffffff",
  },
};

interface CourierLogoProps {
  courier?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showName?: boolean;
}

export function CourierLogo({ courier, className, size = "md", showName = false }: CourierLogoProps) {
  const [imageError, setImageError] = useState(false);
  const rawCode = (courier || "").toLowerCase().trim();

  let code = rawCode;
  if (code.includes("idexpress") || code === "ide") code = "idx";
  if (code.includes("spx") || code.includes("shopee")) code = "spx-express";

  // Match predefined or construct official Lincah CDN URL dynamically
  const infoKey = Object.keys(COURIER_LOGOS).find(
    (k) => rawCode === k || rawCode.includes(k) || k.includes(rawCode)
  );
  const courierInfo = infoKey ? COURIER_LOGOS[infoKey] : null;

  const logoUrl = courierInfo?.logoUrl || `https://assets.lincah.id/images/logo/${code}.png`;
  const courierName = courierInfo?.name || courier?.toUpperCase() || "KURIR";

  const sizeClasses = {
    sm: "h-5 max-w-[60px]",
    md: "h-7 max-w-[90px]",
    lg: "h-9 max-w-[120px]",
    xl: "h-12 max-w-[150px]",
  };

  const badgeSizeClasses = {
    sm: "px-1.5 py-0.5 text-[9px]",
    md: "px-2 py-0.5 text-[10px]",
    lg: "px-2.5 py-1 text-xs",
    xl: "px-3 py-1 text-sm",
  };

  if (!imageError && code) {
    return (
      <div className={cn("inline-flex items-center gap-2 shrink-0", className)}>
        <img
          src={logoUrl}
          alt={courierName}
          onError={() => setImageError(true)}
          className={cn("object-contain rounded-xs transition-opacity", sizeClasses[size])}
        />
        {showName && (
          <span className="font-semibold text-xs text-foreground truncate">
            {courierName}
          </span>
        )}
      </div>
    );
  }

  // Fallback badge if image fails to load
  const bg = courierInfo?.bgColor || "#334155";
  const fg = courierInfo?.textColor || "#ffffff";

  return (
    <div className={cn("inline-flex items-center gap-1.5 shrink-0", className)}>
      <span
        style={{ backgroundColor: bg, color: fg }}
        className={cn(
          "font-bold uppercase tracking-wider rounded font-mono shadow-xs inline-block text-center truncate",
          badgeSizeClasses[size]
        )}
      >
        {courierName}
      </span>
    </div>
  );
}

interface CourierBadgeProps {
  courier?: string | null;
  service?: string | null;
  className?: string;
}

export function CourierBadge({ courier, service, className }: CourierBadgeProps) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-md border bg-background/80 p-1.5 shadow-xs", className)}>
      <CourierLogo courier={courier} size="sm" />
      {service && (
        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {service}
        </span>
      )}
    </div>
  );
}
