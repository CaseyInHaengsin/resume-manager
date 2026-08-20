import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { registerFonts } from "../fonts";
import type { ResumeData } from "../types";

registerFonts();

const sp = { 0: 0, 0.5: 1.5, 1: 3, 1.5: 4.5, 2: 6, 3: 9, 4: 12, 16: 48 } as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: sp[4],
    paddingBottom: sp[4],
    paddingLeft: sp[16],
    paddingRight: sp[16],
    fontFamily: "Inter",
    fontSize: 10,
    color: "#111827",
    lineHeight: 1.3,
  },
  header: { marginBottom: sp[0.5] },
  headerName: { fontSize: 16, fontWeight: "bold", color: "#000", lineHeight: 1.2 },
  headerContact: { fontSize: 9, color: "#374151", marginTop: sp[1], lineHeight: 1.3 },
  section: { marginTop: sp[2] },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", marginBottom: sp[0.5] },
  sectionBar: { height: 3.75, width: 30, backgroundColor: "#374151", marginRight: sp[2] },
  sectionHeaderText: { fontSize: 10, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.3, color: "#000" },
  flexRowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  entryFirst: {},
  entry: { marginTop: sp[1.5] },
  entryTitle: { fontWeight: "bold", fontSize: 10, color: "#000" },
  entryDates: { fontSize: 10, color: "#374151" },
  entrySubtitle: { fontSize: 10, color: "#374151" },
  entryLocation: { fontSize: 10, color: "#374151" },
  bulletList: { marginTop: sp[0.5] },
  bulletRow: { flexDirection: "row", marginBottom: 1 },
  bulletDot: { width: 10, fontSize: 10, color: "#374151", paddingTop: 1 },
  bulletText: { flexGrow: 1, flexBasis: 0, fontSize: 10, color: "#111827", lineHeight: 1.3 },
  inlineRow: { fontSize: 10, marginBottom: 1, color: "#111827" },
  inlineBold: { fontWeight: "bold", color: "#000" },
  summary: { fontSize: 10, color: "#111827", lineHeight: 1.3 },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeadingRow}>
        <View style={styles.sectionBar} />
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.bulletList}>
      {items.map((t, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>{"\u2022"}</Text>
          <Text style={styles.bulletText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function JobEntry({ job, isFirst }: { job: ResumeData["jobs"][0]; isFirst: boolean }) {
  return (
    <View style={isFirst ? styles.entryFirst : styles.entry}>
      <View style={styles.flexRowBetween}>
        <Text style={styles.entryTitle}>{job.title}</Text>
        <Text style={styles.entryDates}>{job.dates}</Text>
      </View>
      <View style={styles.flexRowBetween}>
        <Text style={styles.entrySubtitle}>{job.company}</Text>
        <Text style={styles.entryLocation}>{job.location}</Text>
      </View>
      <BulletList items={job.bullets} />
    </View>
  );
}

function ProjectEntry({ project, isFirst }: { project: ResumeData["projects"][0]; isFirst: boolean }) {
  return (
    <View style={isFirst ? styles.entryFirst : styles.entry}>
      <View style={styles.flexRowBetween}>
        <Text style={styles.entryTitle}>{project.name}</Text>
        <Text style={styles.entryDates}>{project.dates}</Text>
      </View>
      <Text style={styles.entrySubtitle}>{project.tech}</Text>
      <BulletList items={project.bullets} />
    </View>
  );
}

export function ModernTemplate({ data }: { data: ResumeData }) {
  const { contact, summary, jobs, skills, projects, education } = data;
  const contactParts = [contact.phone, contact.email, contact.linkedin, contact.github].filter(Boolean);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerName}>{contact.name}</Text>
          <Text style={styles.headerContact}>{contactParts.join("  |  ")}</Text>
        </View>
        {summary ? <Section title="PROFESSIONAL SUMMARY"><Text style={styles.summary}>{summary}</Text></Section> : null}
        {jobs.length > 0 && <Section title="WORK EXPERIENCE">{jobs.map((j, i) => <JobEntry key={i} job={j} isFirst={i === 0} />)}</Section>}
        {skills.length > 0 && <Section title="TECHNICAL SKILLS">{skills.map((r, i) => <Text key={i} style={styles.inlineRow}><Text style={styles.inlineBold}>{r.category}</Text>{"  |  "}{r.items.join(", ")}</Text>)}</Section>}
        {projects.length > 0 && <Section title="PROJECTS">{projects.map((p, i) => <ProjectEntry key={i} project={p} isFirst={i === 0} />)}</Section>}
        <Section title="EDUCATION"><Text style={styles.inlineRow}><Text style={styles.inlineBold}>{education.school}</Text>{"  |  "}{education.degrees.join(", ")}</Text></Section>
      </Page>
    </Document>
  );
}
