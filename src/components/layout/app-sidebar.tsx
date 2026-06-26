"use client"

import * as React from "react"
import Link from "next/link"
import { 
  LayoutDashboard, 
  CheckSquare,
  LogOut,
  Mail,
  Settings,
  ShieldCheck,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { signOut } from "firebase/auth"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: CheckSquare, label: "Workspace", href: "/tasks" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const { user } = useUser()
  const { setOpenMobile, isMobile } = useSidebar()

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar variant="inset" className="border-r border-slate-100 bg-white">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-none bg-slate-950 flex items-center justify-center shadow-sm">
            <CheckSquare className="text-white h-6 w-6" />
          </div>
          <span className="text-xl font-headline font-bold tracking-tighter text-slate-950 uppercase">TrackIt</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === item.href} 
                  tooltip={item.label} 
                  className="h-11 rounded-none px-4"
                  onClick={handleNavClick}
                >
                  <Link href={item.href}>
                    <item.icon className={pathname === item.href ? "text-primary" : "text-slate-400"} />
                    <span className="font-bold text-slate-900 uppercase tracking-tight text-[12px]">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Sync Configuration</SidebarGroupLabel>
          <div className="px-2 py-3 bg-slate-50 border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-white border border-slate-200 flex items-center justify-center rounded-none shadow-sm">
                  <Mail className="h-3 w-3 text-slate-400" />
                </div>
                <span className="text-[10px] font-bold text-slate-950 uppercase tracking-widest">Inbound Email</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Settings className="h-3 w-3 text-slate-300 cursor-help hover:text-primary transition-colors" />
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-slate-950 text-white rounded-none border-none p-4 max-w-[320px] shadow-2xl">
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-400 border-b border-white/10 pb-2">Official Resend Verification</p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Verification Type:</p>
                        <p className="text-[10px] text-white">Svix / Standard Webhook Signature</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Endpoint URL:</p>
                        <p className="text-[10px] font-mono bg-white/5 p-2 break-all text-slate-200">https://trackit3-virid.vercel.app/api/inbound-email</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Signing Secret:</p>
                        <p className="text-[10px] font-mono text-emerald-400 break-all">Secret_key</p>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Target Recipient:</p>
                <p className="text-[10px] font-bold text-slate-950 uppercase tracking-widest truncate">app@intaaoldei.resend.app</p>
              </div>
              <div className="flex items-center gap-1.5 border-t border-slate-200/50 pt-2">
                <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Official Sync Active</span>
              </div>
            </div>
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-slate-50">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Authorized Profile</span>
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="h-8 w-8 rounded-none bg-slate-950 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-bold text-slate-950 truncate uppercase tracking-tight">
                  {user?.displayName || 'Authorized User'}
                </span>
                <span className="text-[10px] text-slate-400 truncate lowercase font-medium leading-none">
                  {user?.email}
                </span>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => signOut(auth)}
            className="w-full justify-start rounded-none h-10 px-4 text-slate-500 hover:text-destructive hover:bg-destructive/5 font-bold uppercase text-[10px] tracking-widest group"
          >
            <LogOut className="h-4 w-4 mr-3 group-hover:text-destructive transition-colors" />
            Sign Out
          </Button>
          <div className="px-2 pt-2 border-t border-slate-50">
            <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Workspace v1.2.0</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
