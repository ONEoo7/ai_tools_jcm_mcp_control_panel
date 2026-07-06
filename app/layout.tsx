import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { doctor } from "@/lib/jcm/discovery";
import { Dot } from "@/components/ui";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "jCodeMunch Control Panel",
  description: "Deploy, configure, and observe jcodemunch-mcp",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const env = await doctor();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-bg-elevated">
            <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-fg text-lg font-black">
                jC
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-fg">jCodeMunch</span>
                <span className="text-[11px] text-faint">Control Panel</span>
              </span>
            </Link>
            <Nav />
            <div className="border-t border-line-soft px-5 py-3.5">
              <div className="flex items-center gap-2 text-xs">
                <Dot tone={env.installed ? "ok" : "danger"} />
                <span className="text-muted">
                  {env.installed ? (
                    <>
                      Connected{" "}
                      <span className="text-faint">v{env.version}</span>
                    </>
                  ) : (
                    "Not detected"
                  )}
                </span>
              </div>
            </div>
          </aside>
          <main className="flex-1 overflow-x-hidden">
            <div className="w-full px-8 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
