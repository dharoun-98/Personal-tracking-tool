import {
  Document,
  Page,
  Text,
  View,
  Svg,
  Circle,
  Rect,
  Line,
  StyleSheet,
} from "@react-pdf/renderer";
import { DOMAINS, getDomain } from "@/lib/domains";
import { cadenceLabel, difficultyLabel } from "@/lib/format";
import { baselineWord, MOTIVATION_STYLES, RHYTHMS } from "@/lib/onboarding";
import { DOMAIN_PRINT, INK, PAPER, SIZE, SPACE, TYPE, BRAND } from "./theme";
import type { DocumentData } from "./generate";
import type { DomainId } from "@/lib/types";

/* ==================================================================== *
 * "Your Starting Report"
 *
 * A record of day one. Its whole value is that it is fixed in time — this is
 * why baselines are never editable after onboarding. In three months the
 * player should be able to open this and see, honestly, where they began.
 * ==================================================================== */

const s = StyleSheet.create({
  page: {
    backgroundColor: PAPER.base,
    color: INK.base,
    fontFamily: TYPE.sans,
    fontSize: SIZE.body,
    paddingTop: SPACE.page,
    paddingBottom: SPACE.page + 14,
    paddingHorizontal: SPACE.page,
    lineHeight: 1.5,
  },

  /* --- cover ---------------------------------------------------- */
  wordmark: {
    fontFamily: TYPE.sansBold,
    fontSize: SIZE.tiny,
    letterSpacing: 2.4,
    color: BRAND.violet,
  },
  coverTitle: {
    fontFamily: TYPE.serif,
    fontSize: SIZE.display,
    marginTop: 4,
    lineHeight: 1.15,
  },
  coverName: {
    fontFamily: TYPE.sansBold,
    fontSize: SIZE.h2,
    marginTop: SPACE.block,
  },
  dateline: { color: INK.muted, fontSize: SIZE.small, marginTop: 2 },
  lede: {
    fontFamily: TYPE.serifItalic,
    fontSize: 12.5,
    color: INK.muted,
    marginTop: SPACE.block,
    maxWidth: 380,
    lineHeight: 1.6,
  },

  /* --- structure ------------------------------------------------- */
  section: { marginTop: SPACE.section },
  sectionLabel: {
    fontFamily: TYPE.sansBold,
    fontSize: SIZE.tiny,
    letterSpacing: 1.6,
    color: INK.faint,
    marginBottom: SPACE.tight,
  },
  h2: { fontFamily: TYPE.serif, fontSize: SIZE.h1, marginBottom: 4 },
  intro: { color: INK.muted, fontSize: SIZE.small, marginBottom: SPACE.block },
  rule: { height: 1, backgroundColor: INK.rule, marginVertical: SPACE.block },

  /* --- domain rows ----------------------------------------------- */
  domainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: INK.rule,
  },
  domainMain: { flex: 1, paddingRight: 10 },
  domainName: { fontFamily: TYPE.sansBold, fontSize: SIZE.h3 },
  domainTag: { color: INK.faint, fontSize: SIZE.tiny, marginTop: 1 },
  vision: {
    fontFamily: TYPE.serifItalic,
    fontSize: SIZE.small,
    color: INK.muted,
    marginTop: 5,
    paddingLeft: 8,
    borderLeftWidth: 2,
    lineHeight: 1.5,
  },
  scoreBox: { width: 118, alignItems: "flex-end" },
  scoreValue: { fontFamily: TYPE.sansBold, fontSize: SIZE.h2 },
  scoreWord: { fontSize: SIZE.tiny, color: INK.faint, marginBottom: 4 },

  focusPill: {
    alignSelf: "flex-start",
    marginTop: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: SIZE.tiny,
    fontFamily: TYPE.sansBold,
  },

  /* --- quests ----------------------------------------------------- */
  questRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: INK.rule,
  },
  questTitle: { flex: 1, fontSize: SIZE.body },
  questMeta: { fontSize: SIZE.tiny, color: INK.faint, width: 96, textAlign: "right" },
  questEffort: { fontSize: SIZE.tiny, color: INK.faint, width: 40, textAlign: "right" },

  /* --- setup grid -------------------------------------------------- */
  setupGrid: { flexDirection: "row", flexWrap: "wrap" },
  setupCell: {
    width: "50%",
    paddingVertical: 7,
    paddingRight: 12,
  },
  setupKey: { fontSize: SIZE.tiny, color: INK.faint, letterSpacing: 0.8 },
  setupValue: { fontFamily: TYPE.sansBold, fontSize: SIZE.body, marginTop: 1 },

  /* --- explainer ---------------------------------------------------- */
  card: {
    backgroundColor: PAPER.raised,
    borderRadius: 6,
    padding: 14,
    marginTop: SPACE.block,
  },
  cardTitle: { fontFamily: TYPE.sansBold, fontSize: SIZE.h3, marginBottom: 3 },
  cardBody: { fontSize: SIZE.small, color: INK.muted, lineHeight: 1.55 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: SPACE.page,
    right: SPACE.page,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: SIZE.tiny,
    color: INK.faint,
  },
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Ten pips — reads as a considered rating rather than a progress bar. */
function ScorePips({ value, color }: { value: number; color: string }) {
  return (
    <Svg width={112} height={9}>
      {Array.from({ length: 10 }, (_, i) => (
        <Rect
          key={i}
          x={i * 11.4}
          y={0}
          width={8.4}
          height={9}
          rx={1.6}
          fill={i < value ? color : INK.rule}
        />
      ))}
    </Svg>
  );
}

function Footer({ name }: { name: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>Lifequest · Starting Report · {name}</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

export function StartingReport({ data }: { data: DocumentData }) {
  const { profile, quests, goals, startedAt, generatedAt } = data;
  const name = profile.displayName;
  const focus = profile.priorities.slice(0, 3);
  const activeQuests = quests.filter((q) => !q.archivedAt);

  const style =
    MOTIVATION_STYLES.find((m) => m.id === profile.motivationStyle)?.name ?? "—";
  const rhythm = RHYTHMS.find((r) => r.id === profile.rhythm)?.name ?? "—";

  // Domains in the player's own order of importance, then the rest.
  const ordered: DomainId[] = [
    ...focus,
    ...DOMAINS.map((d) => d.id).filter((id) => !focus.includes(id)),
  ];

  return (
    <Document
      title={`Lifequest — Starting Report — ${name}`}
      author="Lifequest"
      subject="Where you stood on day one"
      creator="Lifequest"
      producer="Lifequest"
    >
      {/* ------------------------------------------------- Page 1 */}
      <Page size="A4" style={s.page}>
        <Text style={s.wordmark}>LIFEQUEST</Text>
        <Text style={s.coverTitle}>Your Starting{"\n"}Report</Text>

        <Text style={s.coverName}>{name}</Text>
        <Text style={s.dateline}>Begun {formatDate(startedAt)}</Text>

        <Text style={s.lede}>
          This is where you stood on day one — in your own words, by your own
          reckoning. Nothing here changes. That is the point of it.
        </Text>

        {/* The seven, as a constellation strip */}
        <View style={{ marginTop: SPACE.section + 6 }}>
          <Svg width={480} height={92}>
            {/* Connecting line — a horizon the orbs sit on. */}
            <Line
              x1={26}
              y1={40}
              x2={454}
              y2={40}
              stroke={INK.rule}
              strokeWidth={1}
            />
            {DOMAINS.map((domain, i) => {
              const print = DOMAIN_PRINT[domain.id];
              const score = profile.baselines[domain.id];
              const cx = 26 + i * 71.3;
              // Radius carries the baseline: a bigger body means more there today.
              const r = 9 + (score / 10) * 11;
              return (
                <Circle
                  key={domain.id}
                  cx={cx}
                  cy={40}
                  r={r}
                  fill={print.wash}
                  stroke={print.fill}
                  strokeWidth={1.6}
                />
              );
            })}
          </Svg>
          <View style={{ flexDirection: "row", marginTop: -14 }}>
            {DOMAINS.map((domain) => (
              <View key={domain.id} style={{ width: 71.3, alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: SIZE.tiny,
                    fontFamily: TYPE.sansBold,
                    color: DOMAIN_PRINT[domain.id].ink,
                  }}
                >
                  {domain.name}
                </Text>
                <Text style={{ fontSize: SIZE.tiny, color: INK.faint }}>
                  {profile.baselines[domain.id]}/10
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>HOW YOU SET IT UP</Text>
          <View style={s.setupGrid}>
            <View style={s.setupCell}>
              <Text style={s.setupKey}>FOCUS</Text>
              <Text style={s.setupValue}>
                {focus.length > 0
                  ? focus.map((id) => getDomain(id).name).join(" · ")
                  : "Not chosen"}
              </Text>
            </View>
            <View style={s.setupCell}>
              <Text style={s.setupKey}>COMPANION</Text>
              <Text style={s.setupValue}>{style}</Text>
            </View>
            <View style={s.setupCell}>
              <Text style={s.setupKey}>DAILY TIME</Text>
              <Text style={s.setupValue}>{profile.dailyMinutes} minutes</Text>
            </View>
            <View style={s.setupCell}>
              <Text style={s.setupKey}>CHECK-IN RHYTHM</Text>
              <Text style={s.setupValue}>{rhythm}</Text>
            </View>
            <View style={s.setupCell}>
              <Text style={s.setupKey}>STARTING QUESTS</Text>
              <Text style={s.setupValue}>{activeQuests.length}</Text>
            </View>
            <View style={s.setupCell}>
              <Text style={s.setupKey}>LOOK BACK IN</Text>
              <Text style={s.setupValue}>{profile.promiseHorizonMonths} months</Text>
            </View>
          </View>
        </View>

        <Footer name={name} />
      </Page>

      {/* ------------------------------------------------- Page 2 */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionLabel}>SECTION ONE</Text>
        <Text style={s.h2}>The seven, one at a time</Text>
        <Text style={s.intro}>
          Your own rating of each part of your life, before anything had been
          tracked. Honest beats flattering — and you were asked for honest.
        </Text>

        {ordered.map((id) => {
          const domain = getDomain(id);
          const print = DOMAIN_PRINT[id];
          const score = profile.baselines[id];
          const vision = profile.visions?.[id]?.trim();
          const rank = focus.indexOf(id);

          return (
            <View key={id} style={s.domainRow} wrap={false}>
              <View style={s.domainMain}>
                <Text style={[s.domainName, { color: print.ink }]}>
                  {domain.name}
                </Text>
                <Text style={s.domainTag}>{domain.tagline}</Text>

                {rank >= 0 && (
                  <Text
                    style={[
                      s.focusPill,
                      { backgroundColor: print.wash, color: print.ink },
                    ]}
                  >
                    FOCUS #{rank + 1}
                  </Text>
                )}

                {vision && (
                  <Text style={[s.vision, { borderLeftColor: print.fill }]}>
                    &ldquo;{vision}&rdquo;
                  </Text>
                )}
              </View>

              <View style={s.scoreBox}>
                <Text style={[s.scoreValue, { color: print.ink }]}>{score}/10</Text>
                <Text style={s.scoreWord}>{baselineWord(score)}</Text>
                <ScorePips value={score} color={print.fill} />
              </View>
            </View>
          );
        })}

        <Footer name={name} />
      </Page>

      {/* ------------------------------------------------- Page 3 */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionLabel}>SECTION TWO</Text>
        <Text style={s.h2}>Your starting board</Text>
        <Text style={s.intro}>
          Built to fit {profile.dailyMinutes} minutes a day — the time you said you
          actually have, not the time you wish you had.
        </Text>

        {focus.length === 0 && activeQuests.length === 0 ? (
          <Text style={s.cardBody}>
            You began with an empty board. That is a legitimate way to start: add
            the first quest when you know what it should be.
          </Text>
        ) : (
          DOMAINS.filter((d) => activeQuests.some((q) => q.domain === d.id)).map(
            (domain) => {
              const print = DOMAIN_PRINT[domain.id];
              const inDomain = activeQuests.filter((q) => q.domain === domain.id);
              return (
                <View key={domain.id} style={{ marginBottom: SPACE.block }} wrap={false}>
                  <Text
                    style={{
                      fontFamily: TYPE.sansBold,
                      fontSize: SIZE.h3,
                      color: print.ink,
                      marginBottom: 2,
                    }}
                  >
                    {domain.name}
                  </Text>
                  {inDomain.map((quest) => (
                    <View key={quest.id} style={s.questRow}>
                      <Text style={s.questTitle}>{quest.title}</Text>
                      <Text style={s.questMeta}>{cadenceLabel(quest.cadence)}</Text>
                      <Text style={s.questEffort}>
                        {difficultyLabel(quest.difficulty)}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            },
          )
        )}

        {goals.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>WHAT WINNING LOOKS LIKE</Text>
            {goals.map((goal) => {
              const print = DOMAIN_PRINT[goal.domain];
              return (
                <View
                  key={goal.id}
                  style={[
                    s.card,
                    { backgroundColor: print.wash, marginTop: SPACE.tight },
                  ]}
                  wrap={false}
                >
                  <Text style={[s.cardTitle, { color: print.ink }]}>
                    {getDomain(goal.domain).name}
                  </Text>
                  <Text style={[s.cardBody, { fontFamily: TYPE.serifItalic }]}>
                    {goal.title}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <Footer name={name} />
      </Page>

      {/* ------------------------------------------------- Page 4 */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionLabel}>SECTION THREE</Text>
        <Text style={s.h2}>Reading your own numbers</Text>
        <Text style={s.intro}>
          Four measures, and what each one is honestly telling you.
        </Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>Level — what you have done</Text>
          <Text style={s.cardBody}>
            Earned from every completed quest and never taken away. Level is a
            record, not a judgement. A domain at level 12 stays at level 12 through
            a bad fortnight, because the fortnight does not undo the work.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Vitality — how alive it is right now</Text>
          <Text style={s.cardBody}>
            A rolling fourteen-day reading, weighted so the last few days count
            most. Unlike level, it falls when you stop. That is deliberate: it is
            the honest half of the picture, and it is what makes a dimming orb
            worth noticing.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Streak — showing up</Text>
          <Text style={s.cardBody}>
            Consecutive days you did something. An unfinished today never breaks
            it; the day is not over until it is over. Miss one and you start again
            from one — which is a smaller thing than it feels.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Dormant — not failing</Text>
          <Text style={s.cardBody}>
            A domain with no quests is unlit rather than lost. Four of the seven
            being dark on day one is normal and sensible. You cannot rebuild
            everything at once, and trying is the most common way to quit.
          </Text>
        </View>

        <View style={[s.rule, { marginTop: SPACE.section }]} />
        <Text style={[s.cardBody, { fontFamily: TYPE.serifItalic, fontSize: 11 }]}>
          Generated {formatDate(generatedAt)} from data held on your own device.
          Nothing in this document has been sent anywhere.
        </Text>

        <Footer name={name} />
      </Page>
    </Document>
  );
}
