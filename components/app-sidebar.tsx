"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Home,
  CheckSquare,
  FileText,
  List,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  MessageSquare,
  Search,
  CreditCard,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type NavigationHeader = {
  title: string
  type: "header"
}

type NavigationLink = {
  title: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge: string | null
  badgeVariant?: "secondary" | "default"
}

type NavigationItem = NavigationHeader | NavigationLink

function isNavigationHeader(item: NavigationItem): item is NavigationHeader {
  return "type" in item && item.type === "header"
}

const navigationItems: NavigationItem[] = [
  {
    title: "Dashboard",
    icon: Home,
    href: "/dashboard",
    badge: null,
  },
  {
    title: "FORMAT 1 ANALYSIS",
    type: "header",
  },
  {
    title: "My Tasks",
    icon: CheckSquare,
    href: "/tasks",
    badge: "NEW",
  },
  {
    title: "Tenders",
    icon: FileText,
    href: "/tenders",
    badge: null,
  },
  {
    title: "Bids",
    icon: List,
    href: "/bids2",
    badge: null,
  },
  {
    title: "Bids3",
    icon: List,
    href: "/bids3",
    badge: null,
  },
  {
    title: "Bids4",
    icon: List,
    href: "/bids4",
    badge: null,
  },
  {
    title: "Bid Chat",
    icon: MessageSquare,
    href: "/bid-chat",
    badge: null,
  },
  {
    title: "Search",
    icon: Search,
    href: "/search",
    badge: null,
  },
  {
    title: "Reports",
    icon: BarChart3,
    href: "/reports",
    badge: "15",
    badgeVariant: "secondary",
  },
  {
    title: "ACCOUNT",
    type: "header",
  },
  {
    title: "My Account",
    icon: Users,
    href: "/account",
    badge: null,
  },
  {
    title: "Billing",
    icon: CreditCard,
    href: "/billing",
    badge: null,
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
    badge: null,
  },
  {
    title: "Help",
    icon: HelpCircle,
    href: "/help",
    badge: null,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className={cn(
      "flex h-screen flex-col border-r bg-sidebar transition-all duration-300 ease-in-out",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Logo and Toggle */}
      <div className="border-b p-4">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
        <Link href="/dashboard" className="flex items-center justify-center">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white">
                <Image
                  src="/bid-mitra-ui-logo.png"
                  alt="BidMitra Logo"
                  width={48}
                  height={48}
                  className="rounded-lg"
                  style={{ 
                    objectFit: "cover",
                    objectPosition: "0% center",
                    width: "48px",
                    height: "48px"
                  }}
                />
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center justify-center flex-1">
          <Image
            src="/bid-mitra-ui-logo.png"
            alt="BidMitra Logo"
            width={144}
            height={48}
            className="rounded-lg"
          />
        </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navigationItems.map((item, index) => {
            if (isNavigationHeader(item)) {
              if (isCollapsed) return null
              return (
                <div
                  key={index}
                  className="mb-2 mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {item.title}
                </div>
              )
            }

            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            const Icon = item.icon

            if (isCollapsed) {
              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <Link href={item.href}>
                    <div
                      className={cn(
                          "flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 relative",
                        isActive
                            ? "bg-primary text-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                        {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                            {item.badge}
                          </span>
                      )}
                    </div>
                  </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.title}</p>
                  </TooltipContent>
                </Tooltip>
              )
            }

            return (
              <Link key={index} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
                  <span className="flex-1 transition-opacity duration-200">{item.title}</span>
                  {item.badge && (
                    <Badge
                      variant={item.badgeVariant || "default"}
                      className={
                        item.badgeVariant === "secondary"
                          ? "bg-gray-200 text-gray-800"
                          : "bg-primary/20 text-primary"
                      }
                    >
                      {item.badge}
                    </Badge>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="border-t p-4">
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/logout">
                <div className="flex items-center justify-center rounded-lg p-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50">
                  <LogOut className="h-5 w-5" />
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Logout</p>
            </TooltipContent>
          </Tooltip>
        ) : (
        <Link href="/logout">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50">
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </div>
        </Link>
        )}
      </div>
    </div>
  )
}
