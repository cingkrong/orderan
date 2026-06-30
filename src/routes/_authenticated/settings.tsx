import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "@/lib/settings.functions";
import { syncCities } from "@/lib/shipping.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const fetch = useServerFn(getSettings);
  const update = useServerFn(updateSettings);
  const sync = useServerFn(syncCities);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: () => fetch() });

  const [form, setForm] = useState({
    sender_name: "",
    sender_phone: "",
    sender_city: "",
    sender_address: "",
    origin_city_id: "",
    origin_type: "city" as "city" | "subdistrict",
    logo_url: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        sender_name: data.sender_name,
        sender_phone: data.sender_phone,
        sender_city: data.sender_city,
        sender_address: data.sender_address,
        origin_city_id: data.origin_city_id,
        origin_type: (data.origin_type as any) ?? "city",
        logo_url: data.logo_url ?? "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      update({
        data: { ...form, logo_url: form.logo_url || null },
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => toast.success(`Cities ready (${r.total ?? 0} total)`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Sender info on labels & RajaOngkir origin</p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Sender (printed on labels)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Business / sender name</Label><Input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.sender_phone} onChange={(e) => setForm({ ...form, sender_phone: e.target.value })} /></div>
          <div><Label>City</Label><Input value={form.sender_city} onChange={(e) => setForm({ ...form, sender_city: e.target.value })} /></div>
          <div><Label>Logo URL (optional)</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></div>
        </div>
        <div><Label>Address</Label><Textarea rows={2} value={form.sender_address} onChange={(e) => setForm({ ...form, sender_address: e.target.value })} /></div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">RajaOngkir origin</h2>
        <p className="text-sm text-muted-foreground">
          The warehouse city used to calculate shipping. Click the button below once to load RajaOngkir's city list, then enter your city ID.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Origin city ID</Label>
            <Input value={form.origin_city_id} onChange={(e) => setForm({ ...form, origin_city_id: e.target.value })} placeholder="e.g. 152" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.origin_type} onValueChange={(v) => setForm({ ...form, origin_type: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="city">City</SelectItem>
                <SelectItem value="subdistrict">Subdistrict</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
          {syncMut.isPending ? "Syncing…" : "Sync RajaOngkir city list"}
        </Button>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
