import logo from "./logo-teins.png";

/**
 * El logo oficial de TEINS (DESIGN.md, "Nombre público y logo"). Donde está el logo no se escribe "TEINS".
 * En el tema oscuro se pinta en blanco hasta tener de TEINS la versión en negativo.
 */
export function Logo({ alto, className = "" }: { alto: number; className?: string }) {
  return <img src={logo} alt="TEINS" height={alto} style={{ height: alto, width: "auto", filter: "var(--t-filtro-logo)" }} className={`block ${className}`} />;
}
