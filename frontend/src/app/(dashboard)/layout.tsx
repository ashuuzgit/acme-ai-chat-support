"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { removeToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    href: "/knowledge-base",
    label: "Knowledge Base",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    href: "/ai-config",
    label: "AI Config",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    href: "/tickets",
    label: "Tickets",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    ),
  },
  {
    href: "/conversations",
    label: "Conversations",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
];

const LogoutIcon = () => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
  </svg>
);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // pinned = user clicked to keep sidebar open permanently
  const [pinned, setPinned] = useState(false);
  // hovered = mouse is over the sidebar (temporary expand)
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // leave timer — small delay before collapsing so it doesn't snap shut instantly
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-pinned");
    if (saved !== null) setPinned(JSON.parse(saved));
  }, []);

  const isExpanded = pinned || hovered;

  function togglePin() {
    setPinned((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-pinned", JSON.stringify(next));
      if (next) setHovered(false); // no need for hover state when pinned
      return next;
    });
  }

  function handleMouseEnter() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  }

  function handleMouseLeave() {
    leaveTimer.current = setTimeout(() => setHovered(false), 120);
  }

  function handleNavClick() {
    setMobileOpen(false);
  }

  function handleLogout() {
    removeToken();
    router.push("/login");
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex min-h-screen bg-muted/30">

        {/* Mobile backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "fixed inset-y-0 left-0 z-30 flex flex-col bg-background border-r",
            "transition-[width] duration-300 ease-in-out overflow-hidden",
            // mobile: slide in/out
            "md:static md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            // desktop: narrow when collapsed, full when expanded or hovered
            isExpanded ? "md:w-60" : "md:w-16",
            "w-60",
          )}
        >
          {/* Header */}
          <div className="flex h-16 items-center border-b px-3 shrink-0 gap-2">
            {/* Logo mark — always visible */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              S
            </div>

            {/* Brand name — fades in when expanded */}
            <span
              className={cn(
                "font-semibold text-base tracking-tight whitespace-nowrap flex-1 transition-all duration-200",
                isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none md:hidden"
              )}
            >
              SupportAI
            </span>

            {/* Pin / unpin button — only visible when expanded on desktop */}
            <button
              onClick={togglePin}
              className={cn(
                "hidden md:flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 shrink-0",
                isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
              title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            >
              {pinned ? (
                // X / unpin
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              ) : (
                // Pin icon
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5Z" />
                </svg>
              )}
            </button>

            {/* Close on mobile */}
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors md:hidden shrink-0"
              aria-label="Close menu"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              const navLink = (
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg py-2 text-sm transition-all duration-200",
                    isExpanded ? "px-2.5" : "md:justify-center md:px-2 px-2.5",
                    active
                      ? "bg-primary text-primary-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.10),_0_2px_8px_hsl(var(--primary)/0.06)]"
                  )}
                >
                  {item.icon}
                  <span
                    className={cn(
                      "truncate transition-all duration-200 whitespace-nowrap",
                      isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 md:hidden"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );

              // Show tooltip only when icon-only mode
              if (!isExpanded) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.href}>{navLink}</div>;
            })}
          </nav>

          {/* Sign out */}
          <div className="px-2 py-4 border-t overflow-hidden">
            {!isExpanded ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="hidden md:flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Sign out"
                  >
                    <LogoutIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            ) : null}
            <button
              onClick={handleLogout}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200",
                !isExpanded && "md:hidden"
              )}
            >
              <LogoutIcon />
              <span className={cn("transition-all duration-200 whitespace-nowrap", isExpanded ? "opacity-100" : "opacity-0 w-0")}>
                Sign out
              </span>
            </button>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-h-screen min-w-0">
          {/* Mobile topbar */}
          <header className="flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
                S
              </div>
              <span className="font-semibold text-sm tracking-tight">SupportAI</span>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
