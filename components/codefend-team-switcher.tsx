"use client"

import * as React from "react"
import { Building2, ChevronsUpDown, Shield } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type Organization = {
  id: number;
  name: string;
  repositories: any[];
};

export function CodefendTeamSwitcher() {
  const { isMobile } = useSidebar()
  const [organizations, setOrganizations] = React.useState<Organization[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeOrg, setActiveOrg] = React.useState<Organization | null>(null)
  
  React.useEffect(() => {
    async function fetchOrganizations() {
      try {
        // First fetch organizations
        const orgResponse = await fetch("/api/organizations");
        if (!orgResponse.ok) {
          throw new Error("Failed to fetch organizations");
        }
        const orgData = await orgResponse.json();
        const orgs = orgData.organizations || [];
        
        if (orgs.length > 0) {
          // For each organization, fetch all repositories
          const orgsWithRepos = await Promise.all(
            orgs.map(async (org: Organization) => {
              try {
                const repoResponse = await fetch(
                  `/api/github/repositories?orgId=${org.id}&includeAll=true`
                );
                if (!repoResponse.ok) {
                  throw new Error(
                    `Failed to fetch repositories for ${org.name}`
                  );
                }
                const repoData = await repoResponse.json();
                return {
                  ...org,
                  repositories: repoData.repositories || [],
                };
              } catch (error) {
                console.error(
                  `Error fetching repositories for ${org.name}:`,
                  error
                );
                return {
                  ...org,
                  repositories: [],
                };
              }
            })
          );
          
          setOrganizations(orgsWithRepos);
          
          // Set the first organization as active if available
          if (orgsWithRepos.length > 0) {
            setActiveOrg(orgsWithRepos[0]);
          }
        } else {
          setOrganizations([]);
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrganizations();
  }, []);
  
  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="cursor-default"
          >
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Shield className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Codefend</span>
              <span className="truncate text-xs text-muted-foreground">
                Loading...
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }
  
  if (organizations.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="cursor-default"
          >
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Shield className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Codefend</span>
              <span className="truncate text-xs text-muted-foreground">
                No organizations
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }
  
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeOrg?.name || 'Select Organization'}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeOrg ? `${activeOrg.repositories.length} repositories` : 'No repositories'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organizations.map((org) => (
              <DropdownMenuItem 
                key={org.id}
                onClick={() => setActiveOrg(org)}
              >
                <Building2 className="mr-2 h-4 w-4" />
                {org.name}
                <span className="ml-auto text-xs text-muted-foreground">
                  {org.repositories.length} repos
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
