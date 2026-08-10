import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Applies the saved theme before the browser paints anything.
 *
 * This runs as a blocking inline script at the very top of <body>. Doing it in
 * React instead would mean the page paints with the default theme first and
 * then snaps to the right one — the classic flash of wrong theme. It has to be
 * inline and synchronous; there is no way around that.
 *
 * Keep it small, dependency-free, and defensive: it runs before anything else
 * and an exception here would be an exception on every page load.
 */
const SCRIPT = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(p!=="light"&&p!=="dark"&&p!=="system")p="system";
var r=p==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;
var e=document.documentElement;
e.dataset.theme=r;
e.style.colorScheme=r;
}catch(_){
document.documentElement.dataset.theme="dark";
}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
