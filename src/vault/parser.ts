import matter from "gray-matter";

export interface NoteFrontmatter {
  id: string;
  type: string;
  title: string;
  aliases: string[];
  tags: string[];
  entities: string[];
  status: string;
  visibility: string;
  source_type: string;
  review_status: string;
  created_at: string;
  updated_at: string;
  confidence: string;
  entity_id?: string;
  evidence?: string[];
  [key: string]: unknown;
}

export interface ParsedNote {
  frontmatter: NoteFrontmatter;
  content: string;
  rawContent: string;
  wikilinks: string[];
  headings: Heading[];
}

export interface Heading {
  level: number;
  text: string;
  offset: number;
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const HEADING_RE = /^(#{1,6})\s+(.+)$/gm;

const FRONTMATTER_DEFAULTS: NoteFrontmatter = {
  id: "",
  type: "",
  title: "",
  aliases: [],
  tags: [],
  entities: [],
  status: "active",
  visibility: "agent-readable",
  source_type: "human",
  review_status: "draft",
  created_at: "",
  updated_at: "",
  confidence: "medium",
};

export function parseNote(raw: string): ParsedNote {
  const { data, content } = matter(raw);
  const fm = { ...FRONTMATTER_DEFAULTS, ...data } as NoteFrontmatter;

  if (!Array.isArray(fm.aliases)) fm.aliases = fm.aliases ? [String(fm.aliases)] : [];
  if (!Array.isArray(fm.tags)) fm.tags = fm.tags ? [String(fm.tags)] : [];
  if (!Array.isArray(fm.entities)) fm.entities = fm.entities ? [String(fm.entities)] : [];

  return {
    frontmatter: fm,
    content,
    rawContent: raw,
    wikilinks: extractWikilinks(content),
    headings: extractHeadings(content),
  };
}

export function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return [...new Set(links)];
}

export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  let match: RegExpExecArray | null;
  while ((match = HEADING_RE.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      offset: match.index,
    });
  }
  return headings;
}

export function serializeFrontmatter(fm: Record<string, unknown>): string {
  return matter.stringify("", fm).trim() + "\n";
}

export function buildNoteContent(
  fm: Record<string, unknown>,
  body: string
): string {
  const fmStr = matter.stringify("", fm);
  return fmStr + "\n" + body.trim() + "\n";
}
