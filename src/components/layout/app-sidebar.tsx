"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { OneInboxLogo, OneInboxIcon } from "@/components/icons/oneinbox-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare,
  BookOpen,
  Wallet,
  Bell,
} from "lucide-react";

const navItems = [
  {
    title: "Conversations",
    icon: MessageSquare,
    href: "/",
  },
  {
    title: "Knowledgebase",
    icon: BookOpen,
    href: "/knowledgebase",
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          {isCollapsed ? (
            <OneInboxIcon className="h-7 w-7" />
          ) : (
            <OneInboxLogo className="h-7 w-auto text-foreground" />
          )}
          <SidebarTrigger className="-mr-2" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/" || pathname === "/conversations"
                : pathname.startsWith(item.href);

            return (
              <SidebarMenuItem key={item.title}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={isActive}
                    tooltip={item.title}
                    className="h-10"
                  >
                    <item.icon className="size-5" />
                    <span className="text-sm font-medium">{item.title}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Wallet" className="h-9">
              <Wallet className="size-5" />
              <span className="text-sm">Wallet</span>
              {!isCollapsed && (
                <span className="ml-auto text-xs text-muted-foreground">
                  $111.99
                </span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Notifications" className="h-9">
              <Bell className="size-5" />
              <span className="text-sm">Notifications</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator />

        <div className="flex items-center gap-3 rounded-lg border p-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-muted text-xs font-medium">
              BS
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate text-sm font-medium">
                Bond Street
              </span>
              <div className="relative h-8 w-8 shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-purple-200 text-xs">
                    ND
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-400" />
              </div>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
