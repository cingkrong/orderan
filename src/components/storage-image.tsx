import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Video } from "lucide-react";

const cache = new Map<string, string>();

function extractPrimaryPath(path?: string | null): { cleanPath: string; isVideo: boolean } | null {
  if (!path) return null;
  let raw = path;
  if (raw.startsWith("[") || raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        raw = parsed[0].path || parsed[0].url || "";
      }
    } catch {}
  }
  if (!raw) return null;
  const isVideo = Boolean(raw.match(/\.(mp4|webm|mov|avi)$/i));
  return { cleanPath: raw, isVideo };
}

export function useSignedImage(path?: string | null, bucket = "product-images") {
  const extracted = extractPrimaryPath(path);
  const targetPath = extracted?.cleanPath;
  const [url, setUrl] = useState<string | undefined>(targetPath ? cache.get(targetPath) : undefined);

  useEffect(() => {
    if (!targetPath) return setUrl(undefined);
    if (cache.has(targetPath)) return setUrl(cache.get(targetPath));
    let alive = true;
    supabase.storage.from(bucket).createSignedUrl(targetPath, 3600).then(({ data }) => {
      if (alive && data?.signedUrl) {
        cache.set(targetPath, data.signedUrl);
        setUrl(data.signedUrl);
      }
    });
    return () => {
      alive = false;
    };
  }, [targetPath, bucket]);

  return { url, isVideo: extracted?.isVideo ?? false };
}

export function StorageImage({
  path,
  alt,
  className,
  bucket,
}: {
  path?: string | null;
  alt?: string;
  className?: string;
  bucket?: string;
}) {
  const { url, isVideo } = useSignedImage(path, bucket);

  if (!path || !extractPrimaryPath(path)) {
    return (
      <div className={`flex flex-col items-center justify-center bg-muted/60 text-muted-foreground/50 border border-dashed rounded-md p-2 ${className ?? ""}`}>
        <Package className="size-6 opacity-40 mb-1" />
        <span className="text-[10px] font-medium opacity-60 text-center">No Photo</span>
      </div>
    );
  }

  if (!url) return <div className={`bg-muted animate-pulse rounded-md ${className ?? ""}`} />;

  if (isVideo) {
    return (
      <div className={`relative overflow-hidden bg-black ${className ?? ""}`}>
        <video src={url} className="h-full w-full object-cover" muted playsInline />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
          <Video className="size-5 text-white opacity-80" />
        </div>
      </div>
    );
  }

  return <img src={url} alt={alt ?? ""} className={className} />;
}
