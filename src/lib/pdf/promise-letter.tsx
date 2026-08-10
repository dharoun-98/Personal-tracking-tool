import {
  Document,
  Page,
  Text,
  View,
  Svg,
  Circle,
  Line,
  Path,
  StyleSheet,
} from "@react-pdf/renderer";
import { getDomain } from "@/lib/domains";
import { DOMAIN_PRINT, INK, PAPER, SIZE, SPACE, TYPE, BRAND } from "./theme";
import type { DocumentData } from "./generate";

/* ==================================================================== *
 * "A Promise to Your Future Self"
 *
 * Not a report. A letter, in the player's own words, addressed forward in
 * time. Everything here is in service of it being worth keeping: serif text,
 * generous margins, one page of substance, a place to sign.
 *
 * The player's promise text is reproduced verbatim and never edited,
 * summarised or prettied up. It is the entire point of the document.
 * ==================================================================== */

const s = StyleSheet.create({
  page: {
    backgroundColor: PAPER.base,
    color: INK.base,
    fontFamily: TYPE.serif,
    fontSize: 11.5,
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 62,
    lineHeight: 1.7,
  },

  wordmark: {
    fontFamily: TYPE.sansBold,
    fontSize: SIZE.tiny,
    letterSpacing: 2.4,
    color: BRAND.gold,
    textAlign: "center",
  },
  title: {
    fontFamily: TYPE.serif,
    fontSize: 27,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 1.2,
  },
  subtitle: {
    fontFamily: TYPE.sansOblique,
    fontSize: SIZE.small,
    color: INK.muted,
    textAlign: "center",
    marginTop: 6,
  },

  salutation: {
    fontFamily: TYPE.serif,
    fontSize: 14,
    marginTop: SPACE.section + 8,
  },
  preamble: {
    color: INK.muted,
    fontSize: 10.5,
    marginTop: 10,
    lineHeight: 1.6,
  },

  promiseBlock: {
    marginTop: SPACE.block + 4,
    paddingLeft: 16,
    paddingVertical: 6,
    borderLeftWidth: 2.5,
    borderLeftColor: BRAND.gold,
  },
  promiseText: {
    fontFamily: TYPE.serifItalic,
    fontSize: 14.5,
    lineHeight: 1.75,
    color: INK.base,
  },

  body: { marginTop: SPACE.block + 2, lineHeight: 1.7 },

  focusList: { marginTop: SPACE.block },
  focusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 9,
  },
  focusDot: { marginTop: 4, marginRight: 9 },
  focusName: { fontFamily: TYPE.serifBold, fontSize: 11.5 },
  focusVision: {
    fontFamily: TYPE.serifItalic,
    fontSize: 10.5,
    color: INK.muted,
    lineHeight: 1.55,
  },

  sealRow: {
    marginTop: SPACE.section + 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  signBlock: { width: 210 },
  signLine: { height: 1, backgroundColor: INK.rule, marginBottom: 5 },
  signLabel: { fontSize: SIZE.tiny, color: INK.faint, fontFamily: TYPE.sans },

  openOn: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: PAPER.raised,
    borderRadius: 6,
  },
  openOnLabel: {
    fontSize: SIZE.tiny,
    letterSpacing: 1.4,
    color: INK.faint,
    fontFamily: TYPE.sans,
  },
  openOnDate: {
    fontFamily: TYPE.serifBold,
    fontSize: 15,
    marginTop: 3,
    color: BRAND.gold,
  },

  footNote: {
    marginTop: SPACE.section,
    fontFamily: TYPE.sans,
    fontSize: SIZE.tiny,
    color: INK.faint,
    textAlign: "center",
    lineHeight: 1.6,
  },
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const target = new Date(d);
  target.setMonth(target.getMonth() + months);
  // Rolling over a short month (31 Jan + 1 month) lands in the next one;
  // clamp back to the last valid day so the date reads sensibly.
  if (target.getDate() !== d.getDate()) target.setDate(0);
  return target.toISOString();
}

/** A small compass rose — the letter's only ornament. */
function Ornament() {
  return (
    <Svg width={64} height={64} style={{ alignSelf: "center", marginTop: 18 }}>
      <Circle cx={32} cy={32} r={22} stroke={INK.rule} strokeWidth={1} fill="none" />
      <Circle cx={32} cy={32} r={3.2} fill={BRAND.gold} />
      <Path
        d="M32 6 L35.5 28 L32 32 L28.5 28 Z"
        fill={BRAND.gold}
        fillOpacity={0.9}
      />
      <Line x1={32} y1={54} x2={32} y2={44} stroke={INK.rule} strokeWidth={1} />
      <Line x1={10} y1={32} x2={20} y2={32} stroke={INK.rule} strokeWidth={1} />
      <Line x1={54} y1={32} x2={44} y2={32} stroke={INK.rule} strokeWidth={1} />
    </Svg>
  );
}

export function PromiseLetter({ data }: { data: DocumentData }) {
  const { profile, startedAt, generatedAt } = data;
  const name = profile.displayName;
  const first = name.split(" ")[0] || name;
  const months = profile.promiseHorizonMonths;
  const openOn = addMonths(startedAt, months);
  const focus = profile.priorities.slice(0, 3);
  const promise = profile.promise?.trim();

  return (
    <Document
      title={`Lifequest — Promise to Future Self — ${name}`}
      author={name}
      subject={`Written ${formatDate(startedAt)}, to be opened ${formatDate(openOn)}`}
      creator="Lifequest"
      producer="Lifequest"
    >
      <Page size="A4" style={s.page}>
        <Text style={s.wordmark}>LIFEQUEST</Text>
        <Text style={s.title}>A Promise to{"\n"}Your Future Self</Text>
        <Text style={s.subtitle}>
          Written by {name} on {formatDate(startedAt)}
        </Text>

        <Text style={s.salutation}>{first},</Text>

        {promise ? (
          <>
            <Text style={s.preamble}>
              You wrote this at the start, before any of it had happened. In your
              own words, this is what you said you were going to do:
            </Text>
            <View style={s.promiseBlock}>
              <Text style={s.promiseText}>
                In {months} months, I will have {promise}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={s.preamble}>
              You skipped the promise when you set this up — which is allowed, and
              more honest than writing something you did not mean. The rest of the
              letter still stands, and the page below is yours whenever you are
              ready to fill it in.
            </Text>
            <View style={s.promiseBlock}>
              <Text style={[s.promiseText, { color: INK.faint }]}>
                In {months} months, I will have…
              </Text>
              <View style={{ height: 14 }} />
              <View style={s.signLine} />
              <View style={{ height: 14 }} />
              <View style={s.signLine} />
            </View>
          </>
        )}

        {focus.length > 0 && (
          <View style={s.focusList}>
            <Text style={s.body}>
              These are the three you chose to work on first, and what you said
              winning would look like in each:
            </Text>
            {focus.map((id) => {
              const domain = getDomain(id);
              const print = DOMAIN_PRINT[id];
              const vision = profile.visions?.[id]?.trim();
              return (
                <View key={id} style={s.focusRow} wrap={false}>
                  <Svg width={9} height={9} style={s.focusDot}>
                    <Circle cx={4.5} cy={4.5} r={4} fill={print.fill} />
                  </Svg>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.focusName, { color: print.ink }]}>
                      {domain.name}
                    </Text>
                    <Text style={s.focusVision}>
                      {vision
                        ? `“${vision}”`
                        : "You left this one open — you will know it when you get there."}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={s.body}>
          If you are reading this on the day it was meant to be opened, the only
          question worth asking is whether the person who wrote it would recognise
          the person reading it. Not whether every box was ticked — whether the
          direction held.
        </Text>

        <Text style={s.body}>
          And if it did not hold: you are still here, still reading, which is more
          than most. Begin again from today. That was always the arrangement.
        </Text>

        <Ornament />

        <View style={s.sealRow}>
          <View style={s.signBlock}>
            <View style={s.signLine} />
            <Text style={s.signLabel}>Signed, {name}</Text>
          </View>
          <View style={s.openOn}>
            <Text style={s.openOnLabel}>OPEN ON</Text>
            <Text style={s.openOnDate}>{formatDate(openOn)}</Text>
          </View>
        </View>

        <Text style={s.footNote}>
          Generated {formatDate(generatedAt)} from data held on your own device.{"\n"}
          Print it, keep it, or put it somewhere you will trip over it in {months}{" "}
          months.
        </Text>
      </Page>
    </Document>
  );
}
