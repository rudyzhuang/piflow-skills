#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const bundledTemplatePath = join(skillRoot, "assets", "req-template.md");
const piflowTemplatePath = "/Users/guodongzhuang/github/piflow/templates/req-template.md";

const enumSets = {
  clientTarget: new Set(["website", "admin", "backend", "mobile", "desktop", "miniapp"]),
  versionStatus: new Set(["draft", "ai-reviewed", "reviewed"]),
  structuredSource: new Set(["user", "ai"]),
  freeformSource: new Set(["user", "ai", "from_user", "from_ai"]),
  priority: new Set(["must", "should", "nice"]),
  phase: new Set(["mvp", "v1", "later"]),
  testType: new Set(["smoke", "e2e", "api", "regression", "edge", "error"]),
};

const secretPatterns = [
  /device_api_key/i,
  /cursor_api_key/i,
  /api_key_hash/i,
  /Authorization/i,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/i,
  /session\s*cookie/i,
  /stack trace/i,
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
    "  node scripts/export-req-md.mjs --input export.json --output inputs/req.md",
    "  node scripts/export-req-md.mjs --api-base-url https://host/api/v1 --project-id <id> --device-api-key <secret> --workspace-root /tmp/projects",
    "",
    "Options:",
    "  --input              Local ReqMdExportDocument JSON or rendered Markdown file.",
    "  --output             Output req.md path. Defaults to <workspace-root>/<project-id>/inputs/req.md.",
    "  --api-base-url       Backend API base URL for GET /projects/:id/req-md-export.",
    "  --project-id         Project id used by API mode and default output path.",
    "  --device-api-key     Device api_key used only as Bearer token in API mode.",
    "  --workspace-root     Root used to derive output path.",
    "  --template-path      Preferred PiFlow req-template.md path.",
    "  --source-format      auto | json | markdown. Defaults to auto.",
    "  --json-report        Print the final status object as JSON only.",
  ].join("\n");
}

function fail(errorCode, errorSummary, extra = {}) {
  return {
    status: "failed",
    error_code: errorCode,
    error_summary: redact(errorSummary),
    safe_for_run_status: true,
    ...extra,
  };
}

function redact(text) {
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>")
    .replace(/(device_api_key|cursor_api_key|api_key)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=<redacted>");
}

async function readMaybe(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function loadTemplate(templatePath) {
  const candidates = [templatePath, piflowTemplatePath, bundledTemplatePath].filter(Boolean);
  for (const candidate of candidates) {
    const content = await readMaybe(candidate);
    if (content !== null) return { path: candidate, content };
  }
  throw Object.assign(new Error("No readable req-template.md found."), { code: "REQ_TEMPLATE_MISSING" });
}

function inferFormat(content, contentType, inputPath, forced) {
  if (forced && forced !== "auto") return forced;
  if (contentType?.includes("json")) return "json";
  if (contentType?.includes("markdown") || contentType?.includes("text/")) return "markdown";
  const ext = inputPath ? extname(inputPath).toLowerCase() : "";
  if (ext === ".json") return "json";
  if (ext === ".md" || ext === ".markdown") return "markdown";
  return content.trimStart().startsWith("{") ? "json" : "markdown";
}

async function readSource(args) {
  if (args.input) {
    const inputPath = resolve(String(args.input));
    let content;
    try {
      content = await readFile(inputPath, "utf8");
    } catch (error) {
      throw Object.assign(new Error(`Unable to read input export file: ${error.message}`), {
        code: "REQ_EXPORT_INVALID",
      });
    }
    return {
      content,
      format: inferFormat(content, null, inputPath, args["source-format"] || "auto"),
      sourceDescription: inputPath,
    };
  }

  if (args["api-base-url"] && args["project-id"] && args["device-api-key"]) {
    const baseUrl = String(args["api-base-url"]).replace(/\/+$/, "");
    const projectId = encodeURIComponent(String(args["project-id"]));
    const url = `${baseUrl}/projects/${projectId}/req-md-export`;
    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${args["device-api-key"]}` },
      });
    } catch (error) {
      throw Object.assign(new Error(`Network error while fetching req-md-export: ${error.message}`), {
        code: "REQ_EXPORT_NETWORK_ERROR",
      });
    }

    const content = await response.text();
    if (!response.ok) {
      const codeByStatus = {
        401: "REQ_EXPORT_AUTH_FAILED",
        403: "REQ_EXPORT_FORBIDDEN",
        404: "REQ_EXPORT_NOT_FOUND",
      };
      throw Object.assign(new Error(`req-md-export returned HTTP ${response.status}`), {
        code: codeByStatus[response.status] || "REQ_EXPORT_INVALID",
        httpStatus: response.status,
        body: content,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    return {
      content,
      format: inferFormat(content, contentType, null, args["source-format"] || "auto"),
      sourceDescription: url,
    };
  }

  throw Object.assign(new Error("Missing --input or API context."), { code: "REQ_EXPORT_INVALID" });
}

function requiredString(value, path, errors, allowEmpty = false) {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return "";
  }
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) errors.push(`${path} is required`);
  return trimmed;
}

function normalizeArray(value, path, errors) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  return value.map((item) => (typeof item === "string" ? item.trim() : item)).filter((item) => item !== "");
}

function checkEnum(value, allowed, path, errors, allowEmpty = false) {
  if ((value === undefined || value === null || value === "") && allowEmpty) return "";
  if (!allowed.has(value)) errors.push(`${path} has invalid value: ${value}`);
  return value;
}

function normalizeFreeformSource(value) {
  const raw = String(value || "").trim();
  if (raw === "user") return "from_user";
  if (raw === "ai") return "from_ai";
  return raw;
}

function preferStructured(item, key, fallback = undefined) {
  const structured = item.structured_content && typeof item.structured_content === "object"
    ? item.structured_content
    : {};
  return structured[key] !== undefined ? structured[key] : item[key] ?? fallback;
}

function validateDocument(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { errors: ["export document must be a JSON object"], doc: null };
  }
  for (const field of ["template_ref", "project_name", "project_summary", "client_targets", "features", "test_cases", "non_functional", "deployment", "auth", "tech_constraints", "other_notes"]) {
    if (!(field in raw)) errors.push(`${field} is required`);
  }
  if (raw.template_ref !== undefined && raw.template_ref !== "templates/req-template.md") {
    errors.push("template_ref must be templates/req-template.md");
  }

  const projectName = raw.project_name || {};
  const doc = {
    template_ref: raw.template_ref || "templates/req-template.md",
    project_name: {
      name_zh: requiredString(projectName.name_zh, "project_name.name_zh", errors),
      name_en: requiredString(projectName.name_en, "project_name.name_en", errors),
    },
    project_summary: requiredString(raw.project_summary, "project_summary", errors, true),
    project_freeform_content: String(
      raw.project_freeform_content
      ?? raw.freeform_content
      ?? raw.project_summary_freeform_content
      ?? "",
    ).trim(),
    project_freeform_source: normalizeFreeformSource(
      raw.project_freeform_source
      ?? raw.freeform_source
      ?? raw.project_summary_freeform_source
      ?? "",
    ),
    agent: {
      agent_provider: raw.agent?.agent_provider ? String(raw.agent.agent_provider).trim() : "codex",
      agent_model: raw.agent?.agent_model ? String(raw.agent.agent_model).trim() : "gpt-5.5",
    },
    client_targets: [],
    features: [],
    test_cases: [],
    non_functional: raw.non_functional || {},
    deployment: raw.deployment || {},
    auth: raw.auth || {},
    tech_constraints: raw.tech_constraints || {},
    other_notes: raw.other_notes || {},
  };

  doc.client_targets = normalizeArray(raw.client_targets, "client_targets", errors).map((target, index) => {
    const normalized = {
      target: requiredString(target?.target, `client_targets[${index}].target`, errors),
      positioning: requiredString(target?.positioning, `client_targets[${index}].positioning`, errors, true),
      layout: target?.layout || null,
    };
    checkEnum(normalized.target, enumSets.clientTarget, `client_targets[${index}].target`, errors);
    return normalized;
  });

  doc.features = normalizeArray(raw.features, "features", errors).map((feature, index) => {
    const structuredSource = feature?.structured_source ?? "";
    const freeformSource = feature?.freeform_source ?? "";
    if (!feature?.structured_content || typeof feature.structured_content !== "object" || Array.isArray(feature.structured_content)) {
      errors.push(`features[${index}].structured_content is required`);
    }
    if (!("structured_source" in (feature || {}))) errors.push(`features[${index}].structured_source is required`);
    if (!("freeform_content" in (feature || {}))) errors.push(`features[${index}].freeform_content is required`);
    if (!("freeform_source" in (feature || {}))) errors.push(`features[${index}].freeform_source is required`);
    checkEnum(structuredSource, enumSets.structuredSource, `features[${index}].structured_source`, errors);
    checkEnum(freeformSource, enumSets.freeformSource, `features[${index}].freeform_source`, errors);

    const sourceItemId = feature?.source_item_id == null ? "" : String(feature.source_item_id).trim();
    if (structuredSource === "ai" && !sourceItemId) {
      errors.push(`features[${index}].source_item_id is required for AI-derived features`);
    }
    if (sourceItemId && sourceItemId === feature?.item_id) {
      errors.push(`features[${index}].source_item_id must not equal item_id`);
    }
    if (feature?.is_split_source || feature?.excluded_from_export) {
      errors.push(`features[${index}] appears to be an original split freeform source item and must be excluded`);
    }

    const normalized = {
      heading_client: feature?.heading_client ? String(feature.heading_client).trim() : "",
      heading_title: requiredString(feature?.heading_title, `features[${index}].heading_title`, errors),
      requirement_id: requiredString(feature?.requirement_id, `features[${index}].requirement_id`, errors),
      item_id: requiredString(feature?.item_id, `features[${index}].item_id`, errors),
      source_item_id: sourceItemId,
      version_number: feature?.version_number,
      version_hash: requiredString(feature?.version_hash, `features[${index}].version_hash`, errors),
      version_status: checkEnum(feature?.version_status, enumSets.versionStatus, `features[${index}].version_status`, errors),
      feature_id: feature?.feature_id == null ? "" : String(feature.feature_id).trim(),
      priority: checkEnum(preferStructured(feature, "priority"), enumSets.priority, `features[${index}].priority`, errors),
      phase: checkEnum(preferStructured(feature, "phase"), enumSets.phase, `features[${index}].phase`, errors),
      client_targets: normalizeArray(preferStructured(feature, "client_targets"), `features[${index}].client_targets`, errors),
      description: String(preferStructured(feature, "description", feature?.freeform_content || "") || "").trim(),
      freeform_content: feature?.freeform_content == null ? "" : String(feature.freeform_content).trim(),
      user_stories: normalizeArray(preferStructured(feature, "user_stories"), `features[${index}].user_stories`, errors),
      acceptance_criteria: normalizeArray(preferStructured(feature, "acceptance_criteria"), `features[${index}].acceptance_criteria`, errors),
      dependencies: normalizeArray(preferStructured(feature, "dependencies"), `features[${index}].dependencies`, errors),
      structured_source: structuredSource,
      freeform_source: normalizeFreeformSource(freeformSource),
    };
    if (normalized.version_number === undefined || normalized.version_number === null || normalized.version_number === "") {
      errors.push(`features[${index}].version_number is required`);
    }
    if (!normalized.description) errors.push(`features[${index}].description is required`);
    normalized.client_targets.forEach((target, targetIndex) => {
      checkEnum(target, enumSets.clientTarget, `features[${index}].client_targets[${targetIndex}]`, errors);
    });
    return normalized;
  });

  doc.test_cases = normalizeArray(raw.test_cases, "test_cases", errors).map((testCase, index) => {
    const structuredSource = testCase?.structured_source ?? "";
    const freeformSource = testCase?.freeform_source ?? "";
    if (!testCase?.structured_content || typeof testCase.structured_content !== "object" || Array.isArray(testCase.structured_content)) {
      errors.push(`test_cases[${index}].structured_content is required`);
    }
    if (!("structured_source" in (testCase || {}))) errors.push(`test_cases[${index}].structured_source is required`);
    if (!("freeform_content" in (testCase || {}))) errors.push(`test_cases[${index}].freeform_content is required`);
    if (!("freeform_source" in (testCase || {}))) errors.push(`test_cases[${index}].freeform_source is required`);
    checkEnum(structuredSource, enumSets.structuredSource, `test_cases[${index}].structured_source`, errors);
    checkEnum(freeformSource, enumSets.freeformSource, `test_cases[${index}].freeform_source`, errors);

    const sourceItemId = testCase?.source_item_id == null ? "" : String(testCase.source_item_id).trim();
    if (structuredSource === "ai" && !sourceItemId) {
      errors.push(`test_cases[${index}].source_item_id is required for AI-derived test cases`);
    }
    if (sourceItemId && sourceItemId === testCase?.item_id) {
      errors.push(`test_cases[${index}].source_item_id must not equal item_id`);
    }
    if (testCase?.is_split_source || testCase?.excluded_from_export) {
      errors.push(`test_cases[${index}] appears to be an original split freeform source item and must be excluded`);
    }

    const normalized = {
      title: requiredString(testCase?.title, `test_cases[${index}].title`, errors),
      feature_id: String(preferStructured(testCase, "feature_id", "") || "").trim(),
      item_id: requiredString(testCase?.item_id, `test_cases[${index}].item_id`, errors),
      source_item_id: sourceItemId,
      version_number: testCase?.version_number,
      version_hash: requiredString(testCase?.version_hash, `test_cases[${index}].version_hash`, errors),
      version_status: checkEnum(testCase?.version_status, enumSets.versionStatus, `test_cases[${index}].version_status`, errors),
      client_target: checkEnum(preferStructured(testCase, "client_target"), enumSets.clientTarget, `test_cases[${index}].client_target`, errors),
      type: checkEnum(preferStructured(testCase, "type"), enumSets.testType, `test_cases[${index}].type`, errors),
      priority: checkEnum(preferStructured(testCase, "priority"), enumSets.priority, `test_cases[${index}].priority`, errors),
      preconditions: normalizeArray(preferStructured(testCase, "preconditions"), `test_cases[${index}].preconditions`, errors),
      steps: normalizeArray(preferStructured(testCase, "steps"), `test_cases[${index}].steps`, errors),
      expected: normalizeArray(preferStructured(testCase, "expected"), `test_cases[${index}].expected`, errors),
      test_data: normalizeArray(preferStructured(testCase, "test_data"), `test_cases[${index}].test_data`, errors),
      freeform_content: testCase?.freeform_content == null ? "" : String(testCase.freeform_content).trim(),
      structured_source: structuredSource,
      freeform_source: normalizeFreeformSource(freeformSource),
    };
    if (normalized.version_number === undefined || normalized.version_number === null || normalized.version_number === "") {
      errors.push(`test_cases[${index}].version_number is required`);
    }
    return normalized;
  });

  return { errors, doc };
}

function listLines(items) {
  const values = items && items.length ? items : [""];
  return values.map((item) => `  - ${item}`).join("\n");
}

function bracketList(items) {
  return `[${(items || []).join(", ")}]`;
}

function renderDocument(doc, template) {
  const usePiflowDeployment = template.content.includes("## 部署 *");
  const lines = [];
  lines.push("# 项目需求说明", "");
  lines.push("## 项目名称 *", "");
  lines.push(`项目中文名：${doc.project_name.name_zh}`);
  lines.push(`项目英文名：${doc.project_name.name_en}`, "");
  lines.push("## 项目简介 *", "");
  lines.push(doc.project_summary, "");
  lines.push("## Agent 设置", "");
  lines.push(`agent_provider: ${doc.agent.agent_provider}`);
  lines.push(`agent_model: ${doc.agent.agent_model}`, "");
  lines.push("## 客户端目标 *", "");
  for (const target of doc.client_targets) {
    lines.push(`- ${target.target}: ${target.positioning}`);
    if (target.target === "admin" && target.layout) {
      if (target.layout.layout_shell) lines.push(`  layout_shell: ${target.layout.layout_shell}`);
      if (target.layout.default_route) lines.push(`  default_route: ${target.layout.default_route}`);
      if (Array.isArray(target.layout.menu)) lines.push(`  menu: ${bracketList(target.layout.menu)}`);
    }
  }
  if (!doc.client_targets.length) lines.push("-");
  lines.push("");
  lines.push("## 核心功能 *", "");
  const projectFreeformContent = String(doc.project_freeform_content || "").trim();
  if (projectFreeformContent) {
    lines.push(`freeform_source: ${normalizeFreeformSource(doc.project_freeform_source || "from_user")}`);
    lines.push("freeform_content:");
    lines.push(projectFreeformContent, "");
  }
  for (const feature of doc.features) {
    const headingClient = feature.heading_client || feature.client_targets[0] || "backend";
    lines.push(`### Feature: ${headingClient} 端 - ${feature.heading_title}`, "");
    lines.push(`requirement_id: ${feature.requirement_id}`);
    lines.push(`item_id: ${feature.item_id}`);
    lines.push(`source_item_id: ${feature.source_item_id}`);
    lines.push(`version_number: ${feature.version_number}`);
    lines.push(`version_hash: ${feature.version_hash}`);
    lines.push(`version_status: ${feature.version_status}`);
    lines.push(`feature_id: ${feature.feature_id}`);
    lines.push(`priority: ${feature.priority}`);
    lines.push(`phase: ${feature.phase}`);
    lines.push(`client_targets: ${bracketList(feature.client_targets)}`);
    lines.push(`structured_source: ${feature.structured_source}`);
    lines.push(`freeform_source: ${feature.freeform_source}`);
    lines.push("description:");
    lines.push(feature.description, "");
    lines.push("freeform_content:");
    lines.push(feature.freeform_content || feature.description, "");
    lines.push("user_stories:");
    lines.push(listLines(feature.user_stories), "");
    lines.push("acceptance_criteria:");
    lines.push(`  - requirement_id: ${feature.requirement_id}`);
    lines.push(`  - item_id: ${feature.item_id}`);
    lines.push(`  - source_item_id: ${feature.source_item_id}`);
    lines.push(`  - version_number: ${feature.version_number}`);
    lines.push(`  - version_hash: ${feature.version_hash}`);
    lines.push(`  - version_status: ${feature.version_status}`);
    for (const criterion of feature.acceptance_criteria) lines.push(`  - ${criterion}`);
    lines.push("");
    lines.push(`dependencies: ${bracketList(feature.dependencies)}`, "");
  }
  if (!doc.features.length) lines.push("-", "");
  lines.push("## 非功能需求", "");
  for (const key of ["performance", "security", "availability", "compliance", "accessibility"]) {
    lines.push(`${key}:`);
    lines.push(listLines(normalizeArray(doc.non_functional?.[key], `non_functional.${key}`, [])));
    lines.push("");
  }
  lines.push("## 测试用例", "");
  if (doc.test_cases.length) {
    doc.test_cases.forEach((testCase, index) => {
      const number = String(index + 1).padStart(3, "0");
      lines.push(`### TC-${number}: ${testCase.title}`, "");
      lines.push(`feature_id: ${testCase.feature_id}`);
      lines.push(`item_id: ${testCase.item_id}`);
      lines.push(`source_item_id: ${testCase.source_item_id}`);
      lines.push(`version_number: ${testCase.version_number}`);
      lines.push(`version_hash: ${testCase.version_hash}`);
      lines.push(`version_status: ${testCase.version_status}`);
      lines.push(`client_target: ${testCase.client_target}`);
      lines.push(`type: ${testCase.type}`);
      lines.push(`priority: ${testCase.priority}`);
      lines.push(`structured_source: ${testCase.structured_source}`);
      lines.push(`freeform_source: ${testCase.freeform_source}`, "");
      lines.push("freeform_content:");
      lines.push(testCase.freeform_content || testCase.title, "");
      lines.push("preconditions:");
      lines.push(listLines(testCase.preconditions), "");
      lines.push("steps:");
      lines.push(listLines(testCase.steps), "");
      lines.push("expected:");
      lines.push(listLines(testCase.expected), "");
      lines.push("test_data:");
      lines.push(listLines(testCase.test_data), "");
    });
  } else {
    lines.push("-", "");
  }
  if (usePiflowDeployment) {
    lines.push("## 部署 *", "");
    lines.push(`cloud_provider: ${doc.deployment?.cloud_provider || ""}`);
    lines.push(`domain=${sanitizeDomain(doc.deployment?.domain || "")}`, "");
  } else {
    lines.push("## 部署域名", "");
    lines.push(`DOMAIN=${sanitizeDomain(doc.deployment?.domain || "")}`, "");
  }
  lines.push("## 鉴权方案", "");
  lines.push(`scheme: ${doc.auth?.scheme || "none"}`);
  lines.push(`description: ${doc.auth?.description || ""}`, "");
  lines.push("## 技术约束", "");
  lines.push("stack_preferences:");
  lines.push(listLines(normalizeArray(doc.tech_constraints?.stack_preferences, "tech_constraints.stack_preferences", [])), "");
  lines.push(`forbidden_frameworks: ${bracketList(normalizeArray(doc.tech_constraints?.forbidden_frameworks, "tech_constraints.forbidden_frameworks", []))}`, "");
  lines.push("third_party_limits:");
  lines.push(listLines(normalizeArray(doc.tech_constraints?.third_party_limits, "tech_constraints.third_party_limits", [])), "");
  lines.push("repository_constraints:");
  lines.push(listLines(normalizeArray(doc.tech_constraints?.repository_constraints, "tech_constraints.repository_constraints", [])), "");
  lines.push("## 其他说明", "");
  lines.push(`release_deadline: ${doc.other_notes?.release_deadline || ""}`, "");
  lines.push("mvp_scope:");
  lines.push(listLines(normalizeArray(doc.other_notes?.mvp_scope, "other_notes.mvp_scope", [])), "");
  lines.push("known_risks:");
  lines.push(listLines(normalizeArray(doc.other_notes?.known_risks, "other_notes.known_risks", [])), "");
  lines.push("notes:");
  lines.push(listLines(normalizeArray(doc.other_notes?.notes, "other_notes.notes", [])));
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function sanitizeDomain(value) {
  return String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
}

function validateMarkdown(markdown, template) {
  const errors = [];
  for (const pattern of secretPatterns) {
    if (pattern.test(markdown)) errors.push(`output contains sensitive pattern: ${pattern}`);
  }

  const expectedBeforeDeployment = [
    "# 项目需求说明",
    "## 项目名称 *",
    "## 项目简介 *",
    "## Agent 设置",
    "## 客户端目标 *",
    "## 核心功能 *",
    "## 非功能需求",
    "## 测试用例",
  ];
  const expectedAfterDeployment = [
    "## 鉴权方案",
    "## 技术约束",
    "## 其他说明",
  ];
  const deploymentSections = ["## 部署 *", "## 部署域名"];
  let lastIndex = -1;
  for (const section of expectedBeforeDeployment) {
    const index = markdown.indexOf(section);
    if (index === -1) {
      errors.push(`missing section: ${section}`);
    } else if (index < lastIndex) {
      errors.push(`section out of order: ${section}`);
    }
    lastIndex = index;
  }
  const deploymentIndexes = deploymentSections
    .map((section) => ({ section, index: markdown.indexOf(section) }))
    .filter((item) => item.index !== -1);
  if (!deploymentIndexes.length) {
    errors.push(`missing section: ${template.content.includes("## 部署 *") ? "## 部署 *" : "## 部署域名"}`);
  } else {
    const deployment = deploymentIndexes.sort((a, b) => a.index - b.index)[0];
    if (deployment.index < lastIndex) errors.push(`section out of order: ${deployment.section}`);
    lastIndex = deployment.index;
  }
  for (const section of expectedAfterDeployment) {
    const index = markdown.indexOf(section);
    if (index === -1) {
      errors.push(`missing section: ${section}`);
    } else if (index < lastIndex) {
      errors.push(`section out of order: ${section}`);
    }
    lastIndex = index;
  }

  const domainMatches = markdown.matchAll(/^(?:domain=|DOMAIN=)(.*)$/gm);
  for (const match of domainMatches) {
    const domain = match[1].trim();
    if (/^https?:\/\//i.test(domain) || domain.includes("/")) {
      errors.push("deployment domain must not include protocol or path");
    }
  }

  const featureBlocks = markdown.split(/^### Feature:/m).slice(1);
  for (const [index, block] of featureBlocks.entries()) {
    for (const field of ["feature_id:", "priority:", "phase:", "client_targets:", "structured_source:", "freeform_source:", "description:", "freeform_content:", "user_stories:", "acceptance_criteria:", "dependencies:", "requirement_id:", "item_id:", "source_item_id:", "version_number:", "version_hash:", "version_status:"]) {
      if (!block.includes(field)) errors.push(`feature[${index}] missing ${field}`);
    }
  }

  const testBlocks = markdown.split(/^### TC-\d+:/m).slice(1);
  for (const [index, block] of testBlocks.entries()) {
    for (const field of ["item_id:", "source_item_id:", "version_number:", "version_hash:", "version_status:", "client_target:", "type:", "priority:", "structured_source:", "freeform_source:", "freeform_content:"]) {
      if (!block.includes(field)) errors.push(`test_cases[${index}] missing ${field}`);
    }
  }
  return errors;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  let report;
  try {
    const source = await readSource(args);
    const template = await loadTemplate(args["template-path"]);
    const outputPath = args.output
      ? resolve(String(args.output))
      : resolve(String(args["workspace-root"] || "."), String(args["project-id"] || ""), "inputs", "req.md");

    let markdown;
    let featureCount = null;
    let testCaseCount = null;
    const warnings = [];

    if (source.format === "json") {
      let raw;
      try {
        raw = JSON.parse(source.content);
      } catch (error) {
        throw Object.assign(new Error(`Invalid JSON: ${error.message}`), { code: "REQ_EXPORT_INVALID" });
      }
      const { errors, doc } = validateDocument(raw);
      if (errors.length) {
        throw Object.assign(new Error(errors.join("; ")), { code: "REQ_EXPORT_INVALID" });
      }
      markdown = renderDocument(doc, template);
      featureCount = doc.features.length;
      testCaseCount = doc.test_cases.length;
    } else if (source.format === "markdown") {
      markdown = source.content.endsWith("\n") ? source.content : `${source.content}\n`;
      warnings.push("Backend returned rendered Markdown; structured validation was skipped.");
    } else {
      throw Object.assign(new Error(`Unsupported source format: ${source.format}`), { code: "REQ_EXPORT_INVALID" });
    }

    const markdownErrors = validateMarkdown(markdown, template);
    if (markdownErrors.length) {
      throw Object.assign(new Error(markdownErrors.join("; ")), { code: "REQ_EXPORT_INVALID" });
    }

    try {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, markdown, "utf8");
    } catch (error) {
      throw Object.assign(new Error(`Unable to write req.md: ${error.message}`), { code: "REQ_WRITE_FAILED" });
    }

    report = {
      status: "succeeded",
      output_path: outputPath,
      source_format: source.format,
      template_ref: "templates/req-template.md",
      template_path: template.path,
      feature_count: featureCount,
      test_case_count: testCaseCount,
      warnings,
    };
  } catch (error) {
    report = fail(error.code || "REQ_RENDER_FAILED", error.message);
  }

  if (args["json-report"]) {
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== "succeeded") process.exitCode = 1;
  } else if (report.status === "succeeded") {
    console.log(`req-md export succeeded: ${report.output_path}`);
    if (report.warnings?.length) console.log(`warnings: ${report.warnings.join("; ")}`);
  } else {
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  }
}

main();
