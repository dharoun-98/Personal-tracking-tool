/**
 * The one transactional email the product sends.
 *
 * Plain, narrow, and light — it carries two PDFs and gets out of the way.
 * Written as a string rather than a component so it has no React dependency
 * and can be read at a glance when someone inevitably has to tweak the copy.
 */

export interface DocumentEmailInput {
  name: string;
  /** Number of months until the promise letter's look-back date. */
  horizonMonths: number;
  hasPromise: boolean;
}

export function documentEmailSubject({ name }: DocumentEmailInput): string {
  const first = name.split(" ")[0] || "there";
  return `${first}, here's where you're starting from`;
}

export function documentEmailText(input: DocumentEmailInput): string {
  const first = input.name.split(" ")[0] || "there";
  return [
    `${first},`,
    "",
    "Two things are attached.",
    "",
    "Your starting report is a record of where you stood on day one — your own",
    "ratings across all seven domains, what you chose to focus on, and the board",
    "you began with. It doesn't change. That's the point of it.",
    "",
    input.hasPromise
      ? `Your promise to your future self is in your own words, dated, with a look-back ${input.horizonMonths} months out. Put it somewhere you'll trip over it.`
      : "Your promise letter is there too — you skipped writing one during setup, so it prints with space to fill in by hand.",
    "",
    "Both were generated on your own device. Nothing about your progress is",
    "stored on our side.",
    "",
    "Go play.",
    "",
    "— Lifequest",
  ].join("\n");
}

export function documentEmailHtml(input: DocumentEmailInput): string {
  const first = escapeHtml(input.name.split(" ")[0] || "there");
  const promiseLine = input.hasPromise
    ? `Your <strong>promise to your future self</strong> is in your own words, dated, with a look-back ${input.horizonMonths} months out. Put it somewhere you&rsquo;ll trip over it.`
    : `Your <strong>promise letter</strong> is there too &mdash; you skipped writing one during setup, so it prints with space to fill in by hand.`;

  // Inline styles only, and a light palette: mail clients strip <style> blocks
  // and most people read mail on a white background regardless of their OS theme.
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f6f5fa;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5fa;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;padding:36px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1a2e;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#5646d8;font-weight:700;">LIFEQUEST</p>
          <h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;font-weight:700;color:#16162b;">Here&rsquo;s where you&rsquo;re starting from</h1>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${first},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Two things are attached.</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
            Your <strong>starting report</strong> is a record of where you stood on day one &mdash;
            your own ratings across all seven domains, what you chose to focus on, and the
            board you began with. It doesn&rsquo;t change. That&rsquo;s the point of it.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${promiseLine}</p>

          <p style="margin:0 0 24px;padding:14px 16px;background:#f5f2eb;border-radius:10px;font-size:13px;line-height:1.55;color:#5a5872;">
            Both documents were generated on your own device. Nothing about your day-to-day
            progress is stored on our side.
          </p>

          <p style="margin:0;font-size:15px;line-height:1.6;">Go play.</p>
          <p style="margin:20px 0 0;font-size:13px;color:#8b8aa0;">&mdash; Lifequest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
