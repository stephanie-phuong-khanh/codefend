"use client";

import { Home, Shield } from "lucide-react";
import * as React from "react";

import { CodefendNavUser } from "@/components/codefend-nav-user";
import { CodefendTeamSwitcher } from "@/components/codefend-team-switcher";
import { NavMain } from "@/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

// Codefend specific navigation data
const codefendData = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "/avatars/user.jpg",
  },
  teams: [
    {
      name: "Codefend",
      logo: Shield,
      plan: "Enterprise",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
      isActive: true,
      items: [],
    },
  ],
};

export function CodefendSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <CodefendTeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={codefendData.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <CodefendNavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
