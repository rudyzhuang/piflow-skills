#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { dirname, resolve } from "node:path";

const DEFAULT_BASE_URL = "https://opendesign.cc";
const DEFAULT_LANG = "en";
const DEFAULT_TOP = 5;
const RECOMMENDED_UNITS = [
  "reference-selection",
  "token-definition",
  "layout-principles",
  "component-principles",
  "interaction-principles",
  "content-style",
  "design-guardrails",
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    const key = raw.slice(2, eq === -1 ? undefined : eq);
    const value = eq === -1 ? argv[i + 1] : raw.slice(eq + 1);
    if (eq === -1 && value && !value.startsWith("--")) i += 1;
    args[key] = eq === -1 && (!value || value.startsWith("--")) ? true : value;
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/opendesign-design-system.mjs --slug vercel",
    "  node scripts/opendesign-design-system.mjs --query \"developer tool saas\" --format markdown",
    "  node scripts/opendesign-design-system.mjs --query fintech --output /tmp/design-system.json",
    "",
    "Options:",
    "  --slug              Exact OpenDesign pack slug to use.",
    "  --query             Search query used against OpenDesign catalog.json.",
    "  --lang              DESIGN_SPEC language suffix. Default: en.",
    "  --format            json | markdown. Default: json.",
    "  --output            Write the result to a file instead of stdout only.",
    "  --top               Number of ranked candidates to consider. Default: 5.",
    "  --list-candidates   Only print ranked candidates; do not fetch a pack.",
    "  --base-url          Override OpenDesign base URL. Default: https://opendesign.cc.",
    "  --include-raw       Include full DESIGN_SPEC markdown and DESIGN.md in JSON output.",
  ].join("\n");
}

function fail(message, code = 1) {
  console.error(`ERROR: ${message}`);
  process.exit(code);
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values));
}

function toNumber(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fetchText(url) {
  const client = url.startsWith("https:") ? https : http;
  return await new Promise((resolvePromise, rejectPromise) => {
    const request = client.get(url, (response) => {
      const statusCode = response.statusCode || 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        const redirectedUrl = new URL(location, url).toString();
        fetchText(redirectedUrl).then(resolvePromise, rejectPromise);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        rejectPromise(new Error(`GET ${url} failed with HTTP ${statusCode}`));
        return;
      }

      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolvePromise(body);
      });
    });

    request.on("error", (error) => {
      rejectPromise(new Error(`GET ${url} failed: ${error.message}`));
    });
  });
}

async function fetchJson(url) {
  const text = await fetchText(url);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error.message}`);
  }
}

function scoreDesign(design, queryTokens) {
  const haystack = [
    design.slug,
    design.title,
    design.summary,
    ...(Array.isArray(design.tags) ? design.tags : []),
  ]
    .join(" ")
    .toLowerCase();

  const title = String(design.title || "").toLowerCase();
  const slug = String(design.slug || "").toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    if (slug === token) score += 20;
    else if (slug.includes(token)) score += 10;

    if (title === token) score += 12;
    else if (title.includes(token)) score += 6;

    if (haystack.includes(token)) score += 2;
  }

  const tagHits = (design.tags || []).filter((tag) =>
    queryTokens.some((token) => String(tag).toLowerCase().includes(token)),
  ).length;

  score += tagHits * 3;
  return score;
}

function rankCandidates(catalog, query, top) {
  const queryTokens = unique(tokenize(query));
  const ranked = catalog.designs
    .map((design) => ({
      ...design,
      score: scoreDesign(design, queryTokens),
    }))
    .filter((design) => design.score > 0)
    .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)));

  return ranked.slice(0, top);
}

function findBySlug(catalog, slug) {
  const target = String(slug || "").trim().toLowerCase();
  return catalog.designs.find((design) => String(design.slug || "").toLowerCase() === target) || null;
}

function extractSingleValue(pattern, text) {
  const match = text.match(pattern);
  return match ? match[1].trim() : "";
}

function extractBulletGroup(label, text) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`- \\*\\*${escaped}:\\*\\*\\s+(.+)`, "i"));
  return match ? match[1].trim() : "";
}

function extractDonts(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ❌"))
    .map((line) => line.replace(/^- ❌\s*/, "").trim());
}

function extractSections(markdown) {
  const lines = String(markdown || "").split("\n");
  const sections = [];
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+\d+\.\s+(.+)$/);
    if (heading) {
      if (current) {
        current.content = current.content.join("\n").trim();
        sections.push(current);
      }
      current = {
        title: heading[1].trim(),
        content: [],
      };
      continue;
    }

    if (current) current.content.push(line);
  }

  if (current) {
    current.content = current.content.join("\n").trim();
    sections.push(current);
  }

  return sections;
}

function buildPrimaryReason(design) {
  const tags = Array.isArray(design.tags) ? design.tags.join(", ") : "";
  const summary = String(design.summary || "").trim();
  if (tags && summary) {
    return `Matched by tags [${tags}] and summary fit: ${summary}`;
  }
  if (summary) return summary;
  if (tags) return `Matched by tags [${tags}]`;
  return "Selected from OpenDesign catalog as the best matching primary reference.";
}

function normalizeDesignSystem({ design, catalogUrl, specJson, designSpecMarkdown, designMd, query, lang, backups, includeRaw }) {
  const sections = extractSections(designSpecMarkdown);
  const oneLiner = extractSingleValue(/\*\*One-liner:\*\*\s+(.+)/i, designSpecMarkdown);
  const keywords = extractSingleValue(/\*\*Keywords:\*\*\s+(.+)/i, designSpecMarkdown)
    .split(/\s*·\s*|\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  const analogy = extractSingleValue(/\*\*Analogy:\*\*\s+(.+)/i, designSpecMarkdown);
  const colorPrinciple = extractSingleValue(/\*\*Color principle:\*\*\s+(.+)/i, designSpecMarkdown);
  const tone = extractBulletGroup("Tone", designSpecMarkdown);
  const headlineStyle = extractBulletGroup("Headline style", designSpecMarkdown);
  const ctaStyle = extractBulletGroup("CTA style", designSpecMarkdown);
  const avoid = extractBulletGroup("Avoid", designSpecMarkdown)
    .split(/\s*\/\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  const donts = extractDonts(designSpecMarkdown);

  const primaryReference = {
    library: "opendesign",
    slug: design.slug,
    title: design.title,
    source_url: design.url,
    tags: Array.isArray(design.tags) ? design.tags : [],
    summary: design.summary || "",
    reason: buildPrimaryReason(design),
  };

  const backupReferences = backups.map((item) => ({
    library: "opendesign",
    slug: item.slug,
    title: item.title,
    source_url: item.url,
    tags: Array.isArray(item.tags) ? item.tags : [],
    summary: item.summary || "",
    reason: `Catalog backup candidate with score ${item.score}.`,
  }));

  const tokenRefs = unique([
    ...Object.keys(specJson.colors || {}).map((key) => `color.${key}`),
    ...Object.keys(specJson.typography || {}).map((key) => `typography.${key}`),
    ...Object.keys(specJson.spacing || {}).map((key) => `spacing.${key}`),
    ...Object.keys(specJson.surfaces || {}).map((key) => `surface.${key}`),
    ...Object.keys(specJson.layout || {}).map((key) => `layout.${key}`),
    ...Object.keys(specJson.motion || {}).map((key) => `motion.${key}`),
  ]);

  const componentRefs = unique([
    "navigation shell",
    "page header",
    "card and panel",
    "form controls",
    "data table",
    "empty state",
    "loading state",
    "error state",
    "primary CTA",
  ]);

  const designSystemArtifactId = `opendesign-${design.slug}`;
  const artifactPath = `output-stages/design/design-system/${designSystemArtifactId}.design-system.json`;
  const designSystemRef = `design-system:${designSystemArtifactId}`;
  const visualConstraintRefs = [
    designSystemRef,
    `opendesign:slug:${design.slug}`,
    `opendesign:spec:${design.spec_md}`,
    `opendesign:tokens:${design.spec_json}`,
  ];

  const output = {
    generated_at: new Date().toISOString(),
    source_library: "opendesign",
    source_policy: "primary-built-in",
    selection: {
      query: query || "",
      lang,
    },
    source_urls: {
      catalog: catalogUrl,
      design_spec: design.spec_md,
      spec_json: design.spec_json,
      design_md: `${DEFAULT_BASE_URL}/packs/${design.slug}/DESIGN.md`,
    },
    references: {
      primary_reference: primaryReference,
      backup_references: backupReferences,
    },
    identity: {
      title: design.title || design.slug,
      summary: design.summary || "",
      keywords: unique([...(Array.isArray(design.tags) ? design.tags : []), ...keywords]),
      one_liner: oneLiner,
      analogy,
    },
    foundations: {
      colors: specJson.colors || {},
      typography: specJson.typography || {},
      spacing: specJson.spacing || {},
      surfaces: specJson.surfaces || {},
      layout: specJson.layout || {},
      motion: specJson.motion || {},
    },
    content_style: {
      tone,
      headline_style: headlineStyle,
      cta_style: ctaStyle,
      avoid,
    },
    guardrails: {
      donts,
      color_principle: colorPrinciple,
    },
    sections: sections.map((section) => ({
      title: section.title,
      summary: section.content.split("\n").slice(0, 8).join("\n").trim(),
    })),
    piflow_mapping: {
      stage: "design",
      role: "design-system",
      recommended_units: RECOMMENDED_UNITS,
      downstream_consumers: ["design", "design-review", "codegen"],
    },
    piflow_artifact: {
      artifact_type: "design-system",
      artifact_id: designSystemArtifactId,
      output_path: artifactPath,
      source_priority: 1,
      visual_constraints_template: {
        design_system_refs: visualConstraintRefs,
        component_refs: componentRefs,
        tokens: tokenRefs,
        avoid_patterns: donts,
      },
      design_json_usage: {
        target_field: "implementation_spec.ui_ue_spec.visual_constraints",
        recommended_constraints: [
          `Use ${designSystemRef} as the primary project design-system reference.`,
          `Prefer components and tokens normalized from OpenDesign slug ${design.slug} before introducing new visual patterns.`,
          "If a feature diverges from the shared design system, document the reason in constraints[] and design-review.",
        ],
      },
      downstream_hints: {
        information_architecture_ref: designSystemRef,
        user_journey_ref: designSystemRef,
        state_matrix_ref: designSystemRef,
        responsive_spec_ref: designSystemRef,
        accessibility_ref: designSystemRef,
      },
    },
  };

  if (includeRaw) {
    output.raw = {
      design_spec_markdown: designSpecMarkdown,
      design_md: designMd,
    };
  }

  return output;
}

function renderMarkdown(data) {
  const colors = Object.keys(data.foundations.colors || {});
  const typeScale = Object.keys(data.foundations.typography || {});
  const layoutKeys = Object.keys(data.foundations.layout || {});
  const motionKeys = Object.keys(data.foundations.motion || {});

  return [
    `# ${data.identity.title} · PiFlow Design System Draft`,
    "",
    `- source_library: ${data.source_library}`,
    `- primary_reference: ${data.references.primary_reference.slug}`,
    `- source_url: ${data.references.primary_reference.source_url || "unknown"}`,
    data.selection.query ? `- selection_query: ${data.selection.query}` : null,
    "",
    "## Identity",
    data.identity.one_liner ? `- one_liner: ${data.identity.one_liner}` : null,
    data.identity.summary ? `- summary: ${data.identity.summary}` : null,
    data.identity.keywords.length ? `- keywords: ${data.identity.keywords.join(", ")}` : null,
    data.identity.analogy ? `- analogy: ${data.identity.analogy}` : null,
    "",
    "## Foundations",
    colors.length ? `- colors: ${colors.join(", ")}` : "- colors: none extracted",
    typeScale.length ? `- typography: ${typeScale.join(", ")}` : "- typography: none extracted",
    `- spacing: ${Object.keys(data.foundations.spacing || {}).join(", ") || "none extracted"}`,
    `- surfaces: ${Object.keys(data.foundations.surfaces || {}).join(", ") || "none extracted"}`,
    layoutKeys.length ? `- layout: ${layoutKeys.join(", ")}` : "- layout: none extracted",
    motionKeys.length ? `- motion: ${motionKeys.join(", ")}` : "- motion: none extracted",
    "",
    "## Content Style",
    data.content_style.tone ? `- tone: ${data.content_style.tone}` : null,
    data.content_style.headline_style ? `- headline_style: ${data.content_style.headline_style}` : null,
    data.content_style.cta_style ? `- cta_style: ${data.content_style.cta_style}` : null,
    data.content_style.avoid.length ? `- avoid: ${data.content_style.avoid.join(" / ")}` : null,
    "",
    "## Guardrails",
    data.guardrails.color_principle ? `- color_principle: ${data.guardrails.color_principle}` : null,
    ...(data.guardrails.donts.length
      ? data.guardrails.donts.map((item) => `- don't: ${item}`)
      : ["- don't: none extracted"]),
    "",
    "## PiFlow Mapping",
    `- stage: ${data.piflow_mapping.stage}`,
    `- role: ${data.piflow_mapping.role}`,
    `- units: ${data.piflow_mapping.recommended_units.join(", ")}`,
    `- downstream_consumers: ${data.piflow_mapping.downstream_consumers.join(", ")}`,
    "",
    "## PiFlow Artifact",
    `- artifact_type: ${data.piflow_artifact.artifact_type}`,
    `- artifact_id: ${data.piflow_artifact.artifact_id}`,
    `- output_path: ${data.piflow_artifact.output_path}`,
    `- design_json_target_field: ${data.piflow_artifact.design_json_usage.target_field}`,
    `- design_system_refs: ${data.piflow_artifact.visual_constraints_template.design_system_refs.join(", ")}`,
    `- component_refs: ${data.piflow_artifact.visual_constraints_template.component_refs.join(", ")}`,
    `- token_refs: ${data.piflow_artifact.visual_constraints_template.tokens.slice(0, 12).join(", ")}${data.piflow_artifact.visual_constraints_template.tokens.length > 12 ? " ..." : ""}`,
    "",
    "## Backup References",
    ...(data.references.backup_references.length
      ? data.references.backup_references.map((item) => `- ${item.slug}: ${item.summary || item.reason}`)
      : ["- none"]),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

async function writeOutput(path, text) {
  const target = resolve(String(path));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, text, "utf8");
  return target;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(usage());
    process.exit(0);
  }

  const slug = typeof args.slug === "string" ? args.slug.trim() : "";
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const listOnly = Boolean(args["list-candidates"]);
  const format = String(args.format || "json").toLowerCase();
  const includeRaw = Boolean(args["include-raw"]);
  const lang = String(args.lang || DEFAULT_LANG);
  const top = toNumber(args.top, DEFAULT_TOP);
  const baseUrl = String(args["base-url"] || DEFAULT_BASE_URL).replace(/\/+$/, "");

  if (!slug && !query) {
    fail("Provide either --slug or --query.\n\n" + usage(), 2);
  }
  if (!["json", "markdown"].includes(format)) {
    fail(`Unsupported --format value: ${format}`, 2);
  }

  const catalogUrl = `${baseUrl}/catalog.json`;
  const catalog = await fetchJson(catalogUrl);
  if (!catalog || !Array.isArray(catalog.designs)) {
    fail("OpenDesign catalog.json did not contain a designs array.");
  }

  let primary = null;
  let ranked = [];

  if (slug) {
    primary = findBySlug(catalog, slug);
    if (!primary) {
      fail(`No OpenDesign pack found for slug "${slug}".`);
    }
    ranked = rankCandidates(catalog, primary.title || primary.slug, top + 1)
      .filter((item) => item.slug !== primary.slug);
  } else {
    ranked = rankCandidates(catalog, query, top);
    if (!ranked.length) {
      fail(`No OpenDesign candidates matched query "${query}".`);
    }
    primary = ranked[0];
  }

  if (listOnly) {
    console.log(JSON.stringify({
      query,
      slug,
      candidates: (slug ? [primary, ...ranked.slice(0, top - 1)] : ranked).map((item) => ({
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        tags: item.tags,
        score: item.score ?? null,
        spec_md: item.spec_md,
        spec_json: item.spec_json,
      })),
    }, null, 2));
    process.exit(0);
  }

  const designSpecUrl = primary.spec_md || `${baseUrl}/packs/${primary.slug}/DESIGN_SPEC.${lang}.md`;
  const specJsonUrl = primary.spec_json || `${baseUrl}/packs/${primary.slug}/spec.json`;
  const designMdUrl = `${baseUrl}/packs/${primary.slug}/DESIGN.md`;

  const [designSpecMarkdown, specJson, designMd] = await Promise.all([
    fetchText(designSpecUrl),
    fetchJson(specJsonUrl),
    fetchText(designMdUrl).catch(() => ""),
  ]);

  primary.spec_md = designSpecUrl;
  primary.spec_json = specJsonUrl;

  const backups = (slug ? ranked : ranked.slice(1)).slice(0, 2);
  const normalized = normalizeDesignSystem({
    design: primary,
    catalogUrl,
    specJson,
    designSpecMarkdown,
    designMd,
    query,
    lang,
    backups,
    includeRaw,
  });

  const outputText = format === "markdown"
    ? renderMarkdown(normalized)
    : JSON.stringify(normalized, null, 2);

  if (args.output) {
    const outputPath = await writeOutput(args.output, outputText);
    console.error(`WROTE ${outputPath}`);
  }

  console.log(outputText);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
