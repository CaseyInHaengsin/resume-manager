import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { registerFonts } from "../fonts";
import type { ResumeData } from "../types";

registerFonts();

const sp = { 0: 0, 0.5: 1.5, 1: 3, 1.5: 4.5, 2: 6, 3: 9, 4: 12, 5: 15, 16: 48 } as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: sp[5],
    paddingBottom: sp[5],
    paddingLeft: sp[16],
    paddingRight: sp[16],
    fontFamily: "Lora",
    fontSize: 10,
    color: "#1a1a1a",
    lineHeight: 1.35,
  },
  header: { marginBottom: sp[3] },
  headerName: { fontSize: 22, fontWeight: "bold", color: "#000", lineHeight: 1.1 },
  headerContact: { fontSize: 9, color: "#555", marginTop: sp[1.5], lineHeight: 1.3 },
  section: { marginTop: sp[3] },
  sectionHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#888",
    marginBottom: sp[1],
  },
  flexRowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  entryFirst: {},
  entry: { marginTop: sp[2] },
  entryTitle: { fontWeight: "bold", fontSize: 10, color: "#000" },
  entryDates: { fontSize: 9, color: "#666" },
  entrySubtitle: { fontSize: 10, color: "#444" },
  entryLocation: { fontSize: 9, color: "#666" },
  bulletList: { marginTop: sp[0.5] },
  bulletRow: { flexDirection: "row", marginBottom: 1.5 },
  bulletDash: { width: 10, fontSize: 10, color: "#888" },
  bulletText: { flexGrow: 1, flexBasis: 0, fontSize: 10, color: "#1a1a1a", lineHeight: 1.35 },
  inlineRow: { fontSize: 10, marginBottom: 2, color: "#1a1a1a" },
  inlineBold: { fontWeight: "bold", color: "#000" },
  summary: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.4 },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
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
          <Text style={styles.bulletDash}>{"\u2013"}</Text>
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

export function MinimalTemplate({ data }: { data: ResumeData }) {
  const { contact, summary, jobs, skills, projects, education } = data;
  const contactParts = [contact.phone, contact.email, contact.linkedin, contact.github].filter(Boolean);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerName}>{contact.name}</Text>
          <Text style={styles.headerContact}>{contactParts.join("  \u00b7  ")}</Text>
        </View>
        {summary ? <Section title="SUMMARY"><Text style={styles.summary}>{summary}</Text></Section> : null}
        {jobs.length > 0 && <Section title="EXPERIENCE">{jobs.map((j, i) => <JobEntry key={i} job={j} isFirst={i === 0} />)}</Section>}
        {skills.length > 0 && <Section title="SKILLS">{skills.map((r, i) => <Text key={i} style={styles.inlineRow}><Text style={styles.inlineBold}>{r.category}</Text>{"  \u2014  "}{r.items.join(", ")}</Text>)}</Section>}
        {projects.length > 0 && <Section title="PROJECTS">{projects.map((p, i) => <ProjectEntry key={i} project={p} isFirst={i === 0} />)}</Section>}
        <Section title="EDUCATION"><Text style={styles.inlineRow}><Text style={styles.inlineBold}>{education.school}</Text>{"  \u2014  "}{education.degrees.join(", ")}</Text></Section>
      </Page>
    </Document>
  );
}
