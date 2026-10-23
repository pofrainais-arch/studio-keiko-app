"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tableau de bord" },
  { href: "/devis", label: "Devis" },
  { href: "/realisations", label: "Réalisations" },
  { href: "/clients", label: "Clients" },
];

export default function Nav({ name }: { name: string }) {
  const path = usePathname();
  const router = useRouter();
  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="bar">
      <div className="bar-in">
        <Link href="/" className="brand">
          <span className="rec" aria-hidden="true" />
          <div>
            <h1>Ofi Studio</h1>
            <div className="tag">Ofi Invest AM · devis & production</div>
          </div>
        </Link>
        <nav className="tabs" aria-label="Sections">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={on(l.href) ? "on" : ""} aria-current={on(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="who">
          <span>{name}</span>
          <button onClick={logout}>Déconnexion</button>
        </div>
      </div>
    </header>
  );
}
