/**
 * Adds `js-motion` to <html> before first paint, unless the visitor prefers
 * reduced motion. Animation code may hide elements only under `.js-motion`,
 * so the page stays fully readable without JavaScript or with reduced motion.
 *
 * Phase 0 only sets the class. Any CSS that hides content under `.js-motion`
 * must ship with a failsafe that reveals it if GSAP never initialises.
 */
const SCRIPT = `(function(){try{var m=window.matchMedia("(prefers-reduced-motion: reduce)");if(!m.matches){document.documentElement.classList.add("js-motion")}}catch(e){}})();`;

export function JsMotionScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
