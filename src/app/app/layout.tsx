"use client";

import { Suspense } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Shield, LogOut, User, Mail, ChevronDown, Loader2, PencilLine } from "lucide-react";
import NavigationProgress from "@/components/ui/navigation-progress";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: sessionData, isPending } = useSession();

  // Redirect to login if not authenticated
  if (!isPending && !sessionData?.session) {
    if (pathname && pathname.includes("/app/invites/")) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    } else {
      router.replace("/login");
    }
    return null;
  }

  const user = sessionData?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? "?";

  const handleLogout = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#fffcf5] font-sans text-slate-900 selection:bg-[#8B0000] selection:text-white overscroll-none">
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-white/80 backdrop-blur-lg border-b border-amber-500/15 shadow-sm">
        <div className="max-w-360 mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/app" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-[#8B0000] rounded-lg flex items-center justify-center shadow-md shadow-[#8B0000]/20 group-hover:shadow-lg group-hover:shadow-[#8B0000]/30 transition-all">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-extrabold text-[#3d200a] tracking-tight hidden sm:inline">
              Quant<span className="text-[#8B0000]">Warden</span>
            </span>
          </Link>

          {/* Right: User Profile Dropdown */}
          <div className="flex items-center gap-3">
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#8B0000]" />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#fdf1df] transition-all outline-none focus:ring-2 focus:ring-[#8B0000]/30">
                    <div className="w-9 h-9 rounded-full bg-[#8B0000] flex items-center justify-center text-white text-sm font-bold shadow-md shadow-[#8B0000]/20">
                      {initials}
                    </div>
                    <div className="hidden md:flex flex-col items-start">
                      <span className="text-sm font-bold text-[#3d200a] leading-tight">{user?.name ?? "User"}</span>
                      <span className="text-xs text-[#8a5d33] leading-tight">{user?.email}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-[#8a5d33] hidden md:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <div className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#8B0000] flex items-center justify-center text-white text-base font-bold shadow-md shadow-[#8B0000]/20 shrink-0">
                        {initials}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-[#3d200a] truncate">{user?.name ?? "User"}</p>
                        <p className="text-xs text-[#8a5d33] truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-3">
                    <User className="w-4 h-4 text-[#8a5d33]" />
                    <div>
                      <p className="text-xs text-[#8a5d33]">Full Name</p>
                      <p className="font-semibold text-[#3d200a]">{user?.name ?? "—"}</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-3">
                    <Mail className="w-4 h-4 text-[#8a5d33]" />
                    <div>
                      <p className="text-xs text-[#8a5d33]">Email</p>
                      <p className="font-semibold text-[#3d200a]">{user?.email ?? "—"}</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/app/user-profile")}
                    className="gap-3 bg-[#8B0000] text-white focus:bg-[#730000] focus:text-white"
                  >
                    <PencilLine className="w-4 h-4 text-white" />
                    <span className="font-semibold text-white">Manage profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="gap-3 text-[#8B0000] focus:bg-[#8B0000]/5 focus:text-[#8B0000]"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="font-semibold">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-360 mx-auto px-6 sm:px-8 py-8 pt-24">
        {children}
      </main>
    </div>
  );
}
