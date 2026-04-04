import { readNote } from "../vault/reader.js";
import { writeNote, type WriteResult } from "../vault/writer.js";
import { config } from "../config.js";

export interface CompileRawInput {
  rawPath: string;
  title: string;
  summary: string;
  concepts: string[];
  entities: string[];
  relatedArticles: string[];
  tags?: string[];
  sessionId?: string;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[\/\\]/g, "-")
    .replace(/\.\./g, "")
    .replace(/[<>:"|?*\x00-\x1f]/g, "")
    .trim()
    .slice(0, 100) || "untitled";
}

export function compileRawToWiki(input: CompileRawInput): WriteResult {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/-$/, "");

  const id = `wiki-${slug}`;
  const safeTitle = sanitizeFilename(input.title);
  const relativePath = `${config.dirs.wiki}/${safeTitle}.md`;

  const frontmatter = {
    id,
    type: "wiki-article",
    title: input.title,
    aliases: [],
    tags: input.tags || ["wiki"],
    entities: input.entities,
    status: "active",
    visibility: "agent-readable",
    source_type: "compiled",
    review_status: "draft",
    created_at: dateStr,
    updated_at: dateStr,
    confidence: "medium",
    source_raw: input.rawPath,
  };

  const body = buildWikiBody(input);

  return writeNote(relativePath, frontmatter, body, "kb_compile_raw", input.sessionId);
}

function buildWikiBody(input: CompileRawInput): string {
  const sections: string[] = [];

  sections.push(`# ${input.title}`);
  sections.push(input.summary);

  if (input.concepts.length > 0) {
    sections.push(`## Key Concepts\n\n${input.concepts.map((c) => `- ${c}`).join("\n")}`);
  }

  if (input.relatedArticles.length > 0) {
    sections.push(
      `## Related\n\n${input.relatedArticles.map((a) => `- [[${a}]]`).join("\n")}`
    );
  }

  sections.push(`## Source\n\nCompiled from: \`${input.rawPath}\``);

  return sections.join("\n\n");
}
