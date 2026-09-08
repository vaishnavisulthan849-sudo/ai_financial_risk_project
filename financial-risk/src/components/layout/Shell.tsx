import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Briefcase, 
  Activity, 
  Bell, 
  BrainCircuit, 
  Settings, 
  Search,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Portfolios", path: "/portfolios", icon: Briefcase },
  { name: "Risk Analysis", path: "/risk", icon: Activity },
  { name: "Decisions", path: "/decisions", icon: BrainCircuit },
  { name: "Alerts", path: "/alerts", icon: Bell },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
        return (
          <Link key={item.path} href={item.path}>
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </div>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex w-full flex-col lg:flex-row bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl text-sidebar-primary-foreground tracking-tight">
            <div className="h-8 w-8 bg-primary text-primary-foreground rounded-md flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
            QuantEdge
          </div>
          <div className="text-xs text-sidebar-foreground/50 mt-1 uppercase font-mono tracking-wider">
            Risk Terminal
          </div>
        </div>
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-sidebar-foreground/50" />
            <Input
              type="search"
              placeholder="Search ticker, portfolio..."
              className="w-full bg-sidebar-accent border-none text-sidebar-foreground placeholder:text-sidebar-foreground/50 pl-9 h-9 text-sm focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <NavLinks />
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md cursor-pointer transition-colors">
            <Settings className="h-4 w-4" />
            Settings
          </div>
          <div className="mt-4 flex items-center gap-3 px-3 py-2">
            <Avatar className="h-8 w-8 border border-sidebar-border">
              <AvatarFallback className="bg-sidebar-accent text-xs">PM</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">System Admin</span>
              <span className="text-xs text-sidebar-foreground/50">Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex h-14 items-center gap-4 border-b bg-sidebar px-4 text-sidebar-foreground">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar text-sidebar-foreground border-r-sidebar-border p-0">
              <div className="p-6 pb-2">
                <div className="flex items-center gap-2 font-bold text-xl text-sidebar-primary-foreground tracking-tight">
                  <div className="h-8 w-8 bg-primary text-primary-foreground rounded-md flex items-center justify-center">
                    <Activity className="h-5 w-5" />
                  </div>
                  QuantEdge
                </div>
              </div>
              <nav className="flex-1 space-y-1 p-4">
                <NavLinks />
              </nav>
            </SheetContent>
          </Sheet>
          <div className="w-full flex justify-end">
             <Avatar className="h-8 w-8 border border-sidebar-border">
              <AvatarFallback className="bg-sidebar-accent text-xs">PM</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
