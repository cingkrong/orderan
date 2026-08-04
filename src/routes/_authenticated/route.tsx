import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Package,
  Users,
  Printer,
  Settings,
  LogOut,
  Menu,
  Plus,
  Wallet,
  TrendingUp,
  BarChart3,
  Warehouse,
  UserCircle,
  Plug,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: ProtectedLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/orders", label: "Pesanan", icon: ShoppingCart },
  { to: "/shipping", label: "Pengiriman", icon: Truck },
  { to: "/products", label: "Produk", icon: Package },
  { to: "/customers", label: "Pelanggan", icon: Users },
  { to: "/analyzer", label: "Analyzer", icon: BarChart3 },
  { to: "/integrations", label: "Integrasi Addons", icon: Plug },
  { to: "/labels", label: "Label", icon: Printer },
  { to: "/expenses", label: "Pengeluaran", icon: Wallet },
  { to: "/reports", label: "Laporan L/R", icon: TrendingUp },
  { to: "/warehouses", label: "Gudang", icon: Warehouse },
  { to: "/profile", label: "Profil Saya", icon: UserCircle },
  { to: "/settings", label: "Pengaturan", icon: Settings },
];

function ProtectedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("maularis_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("maularis_sidebar_collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    setSidebarOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const BOTTOM_NAV = [
    { to: "/", label: "Home", icon: LayoutDashboard, exact: true },
    { to: "/orders", label: "Pesanan", icon: ShoppingCart },
    { to: "/orders/new", label: "Buat", icon: Plus, fab: true },
    { to: "/shipping", label: "Kirim", icon: Truck },
    { to: "##more", label: "Lainnya", icon: Menu },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* ═══ Desktop Sidebar ═══ */}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-40 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col transition-all duration-200 ease-in-out",
          "hidden md:flex md:static md:translate-x-0",
          sidebarOpen ? "!flex translate-x-0" : "-translate-x-full",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {/* Sidebar Header & Collapse Toggle */}
        <div
          className={cn(
            "py-4 flex items-center border-b border-sidebar-border transition-all",
            collapsed ? "px-3 justify-center" : "px-4 justify-between",
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="size-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center shrink-0">
              <Package className="size-5" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="font-bold leading-none">MAULARIS</div>
                <div className="text-[11px] text-sidebar-foreground/60 mt-0.5">Catat Orderan</div>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="hidden md:flex size-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
            title={collapsed ? "Perluas Sidebar" : "Kecilkan Sidebar"}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        {/* Action Button: Pesanan Baru */}
        <div className="px-2.5 py-3">
          <Link
            to="/orders/new"
            title={collapsed ? "Pesanan Baru" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium hover:opacity-90 transition-all",
              collapsed ? "justify-center p-2.5" : "px-3 py-2",
            )}
          >
            <Plus className="size-4 shrink-0" />
            {!collapsed && <span>Pesanan baru</span>}
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-2.5 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md text-sm transition-colors",
                  collapsed ? "justify-center p-2.5" : "px-3 py-2",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div className="p-2.5 border-t border-sidebar-border space-y-1">
          <Link
            to="/profile"
            title={collapsed ? user.email : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md hover:bg-sidebar-accent text-sm text-sidebar-foreground transition-colors",
              collapsed ? "justify-center p-2" : "px-3 py-2",
            )}
          >
            <div className="size-7 rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold grid place-items-center shrink-0">
              {user.email ? user.email.charAt(0).toUpperCase() : "U"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{user.email}</div>
                <div className="text-[10px] text-sidebar-foreground/60">Lihat Profil</div>
              </div>
            )}
          </Link>
          <button
            onClick={signOut}
            title={collapsed ? "Keluar" : undefined}
            className={cn(
              "w-full flex items-center gap-2 rounded-md text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
              collapsed ? "justify-center p-2" : "px-3 py-1.5",
            )}
          >
            <LogOut className="size-3.5 shrink-0" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ═══ Main ═══ */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print md:hidden h-12 border-b flex items-center px-4 gap-3 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
          <span className="font-bold text-sm tracking-tight">MAULARIS</span>
        </header>
        <main className="flex-1 p-3 md:p-8 max-w-[1400px] w-full mx-auto print:p-0 print:max-w-none pb-mobile-nav md:!pb-8">
          <Outlet />
        </main>
      </div>

      {/* ═══ Mobile Bottom Nav ═══ */}
      <nav
        className="no-print mobile-only fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-md border-t border-border items-end justify-around"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          const isFab = !!item.fab;
          const isMore = item.to === "##more";
          const active = !isFab && !isMore && isActive(item.to, item.exact);

          if (isFab) {
            return (
              <Link key="fab" to="/orders/new" className="flex flex-col items-center justify-center -mt-4">
                <div className="size-12 rounded-full bg-primary text-primary-foreground shadow-lg grid place-items-center active:scale-95 transition-transform">
                  <Plus className="size-6" />
                </div>
                <span className="text-[10px] mt-0.5 font-medium text-primary">Buat</span>
              </Link>
            );
          }
          if (isMore) {
            return (
              <button
                key="more"
                onClick={() => setMoreOpen((v) => !v)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[56px] transition-colors",
                  moreOpen ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Menu className="size-5" />
                <span className="text-[10px] font-medium">Lainnya</span>
              </button>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[56px] transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ═══ "Lainnya" bottom drawer ═══ */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setMoreOpen(false)} />
          <div
            className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-background rounded-t-2xl shadow-2xl border-t animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)", maxHeight: "75vh" }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-4 pb-2 pt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Menu</p>
            </div>
            <nav className="px-2 pb-3 overflow-y-auto max-h-[55vh] grid grid-cols-4 gap-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to, item.exact);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-colors",
                      active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground active:bg-accent",
                    )}
                  >
                    <Icon className="size-5" />
                    <span className="text-[10px] leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="px-3 pb-3 border-t pt-3 flex gap-2">
              <Link
                to="/profile"
                onClick={() => setMoreOpen(false)}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent text-sm"
              >
                <div className="size-8 rounded-full bg-primary text-primary-foreground text-xs font-bold grid place-items-center">
                  {user.email ? user.email.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{user.email}</div>
                </div>
              </Link>
              <button
                onClick={signOut}
                className="px-4 py-2.5 rounded-xl border text-xs font-medium text-destructive flex items-center gap-1.5 active:bg-destructive/10"
              >
                <LogOut className="size-3.5" /> Keluar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
