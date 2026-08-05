import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";
import { APP_VERSION_ETIKET } from "@/lib/version";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-card/40 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center border-b border-border/60 px-5">
        <Brand />
      </div>

      <SidebarNav />

      <div className="border-t border-border/60 p-3">
        <div className="card-glow flex items-center gap-3 rounded-xl p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            🚀
          </div>
          <div className="text-xs">
            <p className="font-semibold text-foreground">Gezegen CRM</p>
            <p className="text-muted-foreground">{`${APP_VERSION_ETIKET} · Premium`}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
