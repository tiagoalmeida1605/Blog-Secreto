import nexusSymbolDark from "../../assets/nexus-symbol-blue-primary.png";
import nexusSymbolLight from "../../assets/nexus-symbol-navy.png";
import nexusWordmarkDark from "../../assets/nexus-dev-hub-horizontal-light.png";
import nexusWordmarkLight from "../../assets/nexus-dev-hub-horizontal-dark.png";

interface BrandLogoProps {
  layout: "horizontal" | "symbol";
  width: number;
  alt: string;
  className?: string;
}

export function BrandLogo({ layout, width, alt, className = "" }: BrandLogoProps) {
  const darkThemeSource = layout === "symbol" ? nexusSymbolDark : nexusWordmarkDark;
  const lightThemeSource = layout === "symbol" ? nexusSymbolLight : nexusWordmarkLight;

  return (
    <span className={`brand-logo ${className}`} style={{ width }} aria-label={alt} role="img">
      <img className="brand-logo-dark" src={darkThemeSource} alt="" aria-hidden="true" />
      <img className="brand-logo-light" src={lightThemeSource} alt="" aria-hidden="true" />
    </span>
  );
}
