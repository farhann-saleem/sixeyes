import { BrandMark } from "./landing/BrandMark";
import { routeToPath, type Route } from "./Nav";

const START_CREATING: Array<{ label: string; route: Route }> = [
  { label: "Documentaries", route: { name: "projects" } },
  { label: "Avatar", route: { name: "avatar" } },
  { label: "Images", route: { name: "templates" } },
  { label: "Videos", route: { name: "videos" } },
  { label: "Effects", route: { name: "effects" } },
  { label: "Audio", route: { name: "audio" } },
];

const PRODUCT: Array<{ label: string; route: Route }> = [
  { label: "Library", route: { name: "library" } },
  { label: "Pricing", route: { name: "pricing" } },
  { label: "MCP", route: { name: "mcp" } },
];

const LEGAL_LINKS: Array<{ label: string; route: Route }> = [
  { label: "Terms and Conditions", route: { name: "terms" } },
  { label: "Refund Policy", route: { name: "refund" } },
  { label: "Delivery Policy", route: { name: "delivery" } },
  { label: "Cancellation Policy", route: { name: "cancellation" } },
  { label: "Contact Us", route: { name: "contact" } },
];

function FootLink({
  label,
  route,
  onGo,
}: {
  label: string;
  route: Route;
  onGo: (next: Route) => void;
}) {
  return (
    <a
      href={routeToPath(route)}
      onClick={(e) => {
        e.preventDefault();
        onGo(route);
      }}
    >
      {label}
    </a>
  );
}

export function Footer({ onGo }: { onGo: (next: Route) => void }) {
  return (
    <div className="site-foot">
      <div className="site-foot-seam" aria-hidden="true" />
      <footer className="site-footer">
        <div className="site-footer-grid">
          <div className="site-footer-brand-col">
            <div className="site-footer-brand">
              <span className="brand-mark" aria-hidden="true">
                <BrandMark />
              </span>
              <strong>
                MARKETING<em>STUDIO</em>
              </strong>
            </div>
            <p className="site-footer-tagline">Your Imagination Engine</p>
            <p className="site-footer-blurb">Connected video creation with scene-by-scene control.</p>
          </div>
          <nav className="site-footer-col" aria-label="Start creating">
            <p className="site-footer-col-title">Start creating</p>
            {START_CREATING.map((link) => (
              <FootLink key={link.label} {...link} onGo={onGo} />
            ))}
          </nav>
          <nav className="site-footer-col" aria-label="Product">
            <p className="site-footer-col-title">Product</p>
            {PRODUCT.map((link) => (
              <FootLink key={link.label} {...link} onGo={onGo} />
            ))}
          </nav>
          <nav className="site-footer-col" aria-label="Legal">
            <p className="site-footer-col-title">Legal</p>
            {LEGAL_LINKS.map((link) => (
              <FootLink key={link.label} {...link} onGo={onGo} />
            ))}
          </nav>
        </div>
        <div className="site-footer-bot">
          <p>© 2026 Marketing Studio.</p>
        </div>
      </footer>
    </div>
  );
}
