import { StyleSheet } from "@react-pdf/renderer";

// Spacing system (Tailwind-like, 1 unit = 3pt)
const sp = {
  0: 0,
  0.5: 1.5,
  1: 3,
  1.5: 4.5,
  2: 6,
  3: 9,
  4: 12,
  5: 15,
  6: 18,
  16: 48,
} as const;

const FONT_SIZE = 10;

export const styles = StyleSheet.create({
  page: {
    paddingTop: sp[4],
    paddingBottom: sp[4],
    paddingLeft: sp[16],
    paddingRight: sp[16],
    fontFamily: "Inter",
    fontSize: FONT_SIZE,
    color: "#111827",
    lineHeight: 1.3,
  },

  flexRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  flexRowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  flexCol: {
    flexDirection: "column",
  },

  // ── Header ──
  header: {
    marginBottom: sp[0.5],
  },
  headerName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
    lineHeight: 1.2,
  },
  headerContact: {
    fontSize: 9,
    color: "#374151",
    marginTop: sp[1],
    lineHeight: 1.3,
  },

  // ── Section ──
  section: {
    marginTop: sp[2],
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: sp[0.5],
  },
  sectionBar: {
    height: 3.75,
    width: 30,
    backgroundColor: "#374151",
    marginRight: sp[2],
  },
  sectionHeaderText: {
    fontSize: FONT_SIZE,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: "#000000",
  },

  // ── Job/Project Entry ──
  entryFirst: {
    // no top margin for first entry
  },
  entry: {
    marginTop: sp[1.5],
  },
  entryTitle: {
    fontWeight: "bold",
    fontSize: FONT_SIZE,
    color: "#000000",
  },
  entryDates: {
    fontSize: FONT_SIZE,
    color: "#374151",
  },
  entrySubtitle: {
    fontSize: FONT_SIZE,
    color: "#374151",
  },
  entryLocation: {
    fontSize: FONT_SIZE,
    color: "#374151",
  },

  // ── Bullet list ──
  bulletList: {
    marginTop: sp[0.5],
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 1,
  },
  bulletDot: {
    width: 10,
    fontSize: FONT_SIZE,
    color: "#374151",
    paddingTop: 1,
  },
  bulletText: {
    flexGrow: 1,
    flexBasis: 0,
    fontSize: FONT_SIZE,
    color: "#111827",
    lineHeight: 1.3,
  },

  // ── Skills / Education (inline text) ──
  inlineRow: {
    fontSize: FONT_SIZE,
    marginBottom: 1,
    color: "#111827",
  },
  inlineBold: {
    fontWeight: "bold",
    color: "#000000",
  },

  // ── Summary ──
  summary: {
    fontSize: FONT_SIZE,
    color: "#111827",
    lineHeight: 1.3,
  },
});
