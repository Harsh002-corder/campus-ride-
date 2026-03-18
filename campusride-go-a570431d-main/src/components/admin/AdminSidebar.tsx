import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Car,
  Navigation,
  Settings,
  BarChart3,
  Shield,
  ShieldAlert,
} from "lucide-react";

const menuItems = [
  { title: "Overview", key: "overview", icon: LayoutDashboard },
  { title: "Users", key: "users", icon: Users },
  { title: "Rides", key: "rides", icon: Navigation },
  { title: "Drivers", key: "drivers", icon: Car },
  { title: "Issues", key: "issues", icon: ShieldAlert },
  { title: "Settings", key: "settings", icon: Settings },
];

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingIssuesCount?: number;
}

export function AdminSidebar({ activeTab, setActiveTab, pendingIssuesCount = 0 }: AdminSidebarProps) {
  return (
    <Sidebar className="border-r border-border">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-4 mb-2">
            <Shield className="w-3 h-3 mr-1 inline" /> Admin Panel
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    onClick={() => setActiveTab(item.key)}
                    isActive={activeTab === item.key}
                    className="cursor-pointer"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                    {item.key === "issues" && pendingIssuesCount > 0 && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                        {pendingIssuesCount > 99 ? "99+" : pendingIssuesCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-4 mb-2">
            <BarChart3 className="w-3 h-3 mr-1 inline" /> Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-4 space-y-3">
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Today's Revenue</p>
                <p className="text-lg font-bold font-display gradient-text">₹24,580</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Active Users</p>
                <p className="text-lg font-bold font-display text-foreground">1,247</p>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
