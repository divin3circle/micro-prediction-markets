"use client";
import React from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

export type Header3Props = {
  walletNode: React.ReactNode;
  rightInfoNode?: React.ReactNode;
  onDeposit: () => void;
};

export function Header({ walletNode, rightInfoNode, onDeposit }: Header3Props) {
  const [open, setOpen] = React.useState(false);
  const scrolled = useScroll(10);

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn("sticky top-0 z-50 w-full border-b border-transparent", {
        "bg-[#0D0D0F]/90 border-[#2A2A35] backdrop-blur-lg": scrolled,
      })}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-4">
        <div className="flex items-center gap-4 lg:gap-7">
          <Link to="/" className="rounded-md p-1 hover:bg-[#16161A]">
            <Wordmark />
          </Link>

          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className="rounded-md px-3 py-2 text-sm font-medium text-[#A1A1B0] hover:bg-[#16161A] hover:text-white"
                >
                  <Link to="/">Markets</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className="rounded-md px-3 py-2 text-sm font-medium text-[#A1A1B0] hover:bg-[#16161A] hover:text-white"
                >
                  <Link to="/positions">My Positions</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className="rounded-md px-3 py-2 text-sm font-medium text-[#A1A1B0] hover:bg-[#16161A] hover:text-white"
                >
                  <Link to="/create">Create</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="outline"
            className="border-[#2A2A35] bg-[#16161A] text-white hover:bg-[#20202A] rounded-2xl"
            onClick={onDeposit}
          >
            Deposit
          </Button>
          {walletNode}
          {rightInfoNode}
        </div>

        <Button
          size="icon"
          variant="outline"
          onClick={() => setOpen(!open)}
          className="border-[#2A2A35] bg-[#16161A] text-white md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label="Toggle menu"
        >
          <MenuToggleIcon open={open} className="size-5" duration={300} />
        </Button>
      </nav>

      <MobileMenu
        open={open}
        className="flex flex-col gap-4 overflow-y-auto p-4"
      >
        <div className="flex flex-col gap-2">
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-sm font-medium text-[#E5E7EB] hover:bg-[#16161A]"
          >
            Markets
          </Link>
          <Link
            to="/positions"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-sm font-medium text-[#E5E7EB] hover:bg-[#16161A]"
          >
            My Positions
          </Link>
          <Link
            to="/create"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-sm font-medium text-[#E5E7EB] hover:bg-[#16161A]"
          >
            Create
          </Link>
        </div>
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full border-[#2A2A35] bg-[#16161A] text-white hover:bg-[#20202A]"
            onClick={() => {
              setOpen(false);
              onDeposit();
            }}
          >
            Deposit
          </Button>
          <div className="rounded-xl border border-[#2A2A35] bg-[#16161A] p-2">
            <p className="px-1 pb-2 text-xs uppercase tracking-wide text-[#9CA3AF]">
              Wallet
            </p>
            {walletNode}
          </div>
          {rightInfoNode ? (
            <div className="rounded-xl border border-[#2A2A35] bg-[#16161A] p-2">
              <p className="px-1 pb-2 text-xs uppercase tracking-wide text-[#9CA3AF]">
                Balances
              </p>
              {rightInfoNode}
            </div>
          ) : null}
        </div>
      </MobileMenu>
    </header>
  );
}

type MobileMenuProps = React.ComponentProps<"div"> & {
  open: boolean;
};

function MobileMenu({ open, children, className, ...props }: MobileMenuProps) {
  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div
      id="mobile-menu"
      className={cn(
        "bg-[#0D0D0F]/95 backdrop-blur-lg fixed top-16 right-0 bottom-0 left-0 z-40 border-y border-[#2A2A35] md:hidden",
      )}
    >
      <div
        data-slot={open ? "open" : "closed"}
        className={cn(
          "data-[slot=open]:animate-in data-[slot=open]:zoom-in-97 ease-out size-full",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function useScroll(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false);

  const onScroll = React.useCallback(() => {
    setScrolled(window.scrollY > threshold);
  }, [threshold]);

  React.useEffect(() => {
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  React.useEffect(() => {
    onScroll();
  }, [onScroll]);

  return scrolled;
}

function Wordmark() {
  return (
    <span className="text-xl lowercase font-mono font-semibold tracking-tight">
      <span className="text-white">PULSE.</span>
      <span className="text-[#7C5CFC]">MARKET</span>
    </span>
  );
}
