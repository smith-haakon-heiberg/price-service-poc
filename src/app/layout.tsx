import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Price System Admin",
  description: "Admin UI for inspecting and managing pricing rules",
};

const navItems = [
  { href: "/", label: "Dashboard", icon: "~" },
  { href: "/admin/products", label: "Products", icon: "P" },
  { href: "/admin/rules", label: "Rules", icon: "R" },
  { href: "/admin/explain", label: "Price Explainer", icon: "?" },
  { href: "/admin/customers", label: "Customers", icon: "C" },
  { href: "/admin/categories", label: "Categories", icon: "G" },
  { href: "/admin/warehouses", label: "Warehouses", icon: "W" },
  { href: "/admin/integrations/pim", label: "PIM Integrator", icon: "I" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <nav className="w-56 shrink-0 bg-sidebar-bg text-sidebar-fg flex flex-col">
            <div className="px-4 py-4 border-b border-white/10">
              <h1 className="text-base font-bold tracking-tight text-white">
                Price System
              </h1>
              <span className="text-xs text-sidebar-fg/60">Admin</span>
            </div>
            <ul className="flex-1 py-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-sidebar-fg/80 hover:bg-white/10 hover:text-white transition-colors no-underline"
                  >
                    <span className="w-5 h-5 flex items-center justify-center rounded bg-white/10 text-xs font-mono font-bold">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 border-t border-white/10 text-xs text-sidebar-fg/40">
              Price System POC
            </div>
          </nav>
          <main className="flex-1 overflow-auto">
            <div className="p-6 max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
