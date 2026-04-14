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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { OneInboxLogo, OneInboxIcon } from "@/components/icons/oneinbox-logo";
import {
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = usePathname();
  const { t } = useI18n();

  const navItems = [
    {
      title: t("conversations"),
      icon: MessageSquare,
      href: "/",
    },
    {
      title: t("knowledgebase"),
      icon: BookOpen,
      href: "/knowledgebase",
    },
  ];

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
              <SidebarMenuItem key={item.href}>
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

      <SidebarFooter className="px-3 pb-4" />
    </Sidebar>
  );
}
