"use client";

import { CodefendSidebar } from "@/components/codefend-sidebar";
import { Providers } from "@/components/providers";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();

        if (!data.authenticated) {
          // Redirect to login if not authenticated
          router.push("/");
        }
      } catch (error) {
        console.error("Error checking session:", error);
        // Redirect to login on error
        router.push("/");
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Providers>
      <div className="flex h-screen w-full">
        <CodefendSidebar className="h-screen" />
        <div className="flex-1 overflow-auto w-full">
          <main className="p-6 w-full">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
