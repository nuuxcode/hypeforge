// Fixed, purely decorative background layer rendered once behind every page.
// It sits at z-index -1 (see globals.css) so real content always paints above
// it. Theme colors are driven from globals.css via `body:has(.v2-shell.v2-dark)`
// because the theme class lives on the in-page shell, not on <html>/<body>.
export function AppBackdrop() {
  return (
    <div aria-hidden="true" className="app-backdrop">
      <div className="app-backdrop-glow app-backdrop-glow-violet" />
      <div className="app-backdrop-glow app-backdrop-glow-ember" />
      <div className="app-backdrop-dots" />
    </div>
  );
}
