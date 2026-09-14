import { BrandMark, Squiggle } from "./landing/BrandMark";
import { routeToPath, type Route } from "./Nav";

const LINKS: Array<{ label: string; route: Route }> = [
  { label: "Documentaries", route: { name: "projects" } },
  { label: "Create avatar", route: { name: "avatar" } },
  { label: "Images", route: { name: "templates" } },
  { label: "Videos", route: { name: "videos" } },
  { label: "Effects", route: { name: "effects" } },
  { label: "Audio", route: { name: "audio" } },
  { label: "Library", route: { name: "library" } },
  { label: "MCP", route: { name: "mcp" } },
];

export function Footer({ onGo }: { onGo: (next: Route) => void }) {
  return (
    <div className="site-foot">
      <Squiggle fill="#150f23" />
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <span className="brand-mark" aria-hidden="true">
              <BrandMark />
            </span>
            <strong>
              MARKETING<em>STUDIO</em>
            </strong>
          </div>
          <nav className="site-footer-links" aria-label="Footer">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={routeToPath(link.route)}
                onClick={(e) => {
                  e.preventDefault();
                  onGo(link.route);
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="site-footer-bot">
          <p>© 2026 Marketing Studio. Topic → script → cast → mix.</p>
          <p>One project is a film. Not a generate wall.</p>
        </div>
      </footer>
    </div>
  );
}
