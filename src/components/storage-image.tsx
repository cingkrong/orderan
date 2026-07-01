import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon } from "lucide-react";

const cache = new Map<string, string>();

export function useSignedImage(path?: string | null, bucket = "product-images") {
  const [url, setUrl] = useState<string | undefined>(path ? cache.get(path) : undefined);
  useEffect(() => {
    if (!path) return setUrl(undefined);
    if (cache.has(path)) return setUrl(cache.get(path));
    let alive = true;
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
      if (alive && data?.signedUrl) {
        cache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      }
    });
    return () => {
      alive = false;
    };
  }, [path, bucket]);
  return url;
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
  const url = useSignedImage(path, bucket);
  if (!path) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}>
        <ImageIcon className="size-5 opacity-40" />
      </div>
    );
  }
  if (!url) return <div className={`bg-muted animate-pulse ${className ?? ""}`} />;
  return <img src={url} alt={alt ?? ""} className={className} />;
}
