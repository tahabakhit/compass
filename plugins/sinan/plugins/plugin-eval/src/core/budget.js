import fs from "node:fs/promises";
import path from "node:path";

import { parseFrontmatter, parseYamlDocument } from "../lib/frontmatter.js";
import { isDirectory, isProbablyTextFile, pathExists, readJson, readText, relativePath, walkFiles } from "../lib/files.js";
import { estimateTokenCount, sumTokenCounts } from "../lib/tokens.js";

function createComponent(label, componentPath, tokens, note) {
  return {
    label,
    path: componentPath,
    tokens,
    note,
  };
}

function buildBudgetBucket(value, thresholds, components) {
  const [goodMax, moderateMax, heavyMax] = thresholds;
  const band =
    value <= goodMax ? "good" : value <= moderateMax ? "moderate" : value <= heavyMax ? "heavy" : "excessive";
  return {
    value,
    band,
    thresholds: {
      goodMax,
      moderateMax,
      heavyMax,
    },
    components,
  };
}

async function gatherDeferredTextFiles(rootPath, excludeFiles = []) {
  const files = await walkFiles(rootPath);
  return files.filter(
    (filePath) => !excludeFiles.includes(filePath) && isProbablyTextFile(filePath),
  );
}

async function gatherTextFilesFromPath(targetPath) {
  if (await isDirectory(targetPath)) {
    const files = await walkFiles(targetPath);
    return files.filter((filePath) => isProbablyTextFile(filePath));
  }
  if ((await pathExists(targetPath)) && isProbablyTextFile(targetPath)) {
    return [targetPath];
  }
  return [];
}

async function computeDeferredComponents(rootPath, excludeFiles = []) {
  const files = await gatherDeferredTextFiles(rootPath, excludeFiles);
  const components = [];
  for (const filePath of files) {
    const content = await readText(filePath);
    components.push(
      createComponent(
        relativePath(rootPath, filePath),
        filePath,
        estimateTokenCount(content),
        "Deferred supporting file",
      ),
    );
  }
  return components;
}

function normalizeRelativeManifestPath(pluginRoot, fieldValue) {
  if (typeof fieldValue !== "string" || !fieldValue.startsWith("./")) {
    return null;
  }
  const resolvedPath = path.resolve(pluginRoot, fieldValue);
  const relative = path.relative(pluginRoot, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return resolvedPath;
}

function collectManifestPathFields(pluginRoot, manifest) {
  const iface = manifest?.interface || {};
  const values = [
    manifest?.skills || "./skills/",
    manifest?.hooks,
    manifest?.mcpServers,
    manifest?.apps,
    iface.composerIcon,
    iface.logo,
    ...(Array.isArray(iface.screenshots) ? iface.screenshots : []),
  ];

  return values
    .map((value) => normalizeRelativeManifestPath(pluginRoot, value))
    .filter(Boolean);
}

function isSameOrInside(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function computePluginDeferredComponents(pluginRoot, manifest, skillPolicies, excludeFiles) {
  const packageRoots = collectManifestPathFields(pluginRoot, manifest);
  const packageFileSet = new Set();
  for (const packageRoot of packageRoots) {
    for (const filePath of await gatherTextFilesFromPath(packageRoot)) {
      packageFileSet.add(filePath);
    }
  }

  const excluded = new Set(excludeFiles);
  const scoredComponents = [];
  const explicitOnlyComponents = [];

  for (const filePath of [...packageFileSet].sort()) {
    if (excluded.has(filePath)) {
      continue;
    }

    const owningSkill = skillPolicies.find((entry) => isSameOrInside(filePath, entry.skillDir));
    const content = await readText(filePath);
    if (owningSkill?.allowImplicitInvocation === false) {
      explicitOnlyComponents.push(
        createComponent(
          relativePath(pluginRoot, filePath),
          filePath,
          estimateTokenCount(content),
          "Explicit-only skill supporting file; excluded from implicit deferred budget",
        ),
      );
      continue;
    }

    scoredComponents.push(
      createComponent(
        relativePath(pluginRoot, filePath),
        filePath,
        estimateTokenCount(content),
        owningSkill ? "Implicit skill supporting file" : "Plugin package supporting file",
      ),
    );
  }

  const accountedFiles = new Set([...packageFileSet, ...excludeFiles]);
  const unpackagedComponents = [];
  for (const filePath of await gatherDeferredTextFiles(pluginRoot, [])) {
    if (accountedFiles.has(filePath)) {
      continue;
    }
    const content = await readText(filePath);
    unpackagedComponents.push(
      createComponent(
        relativePath(pluginRoot, filePath),
        filePath,
        estimateTokenCount(content),
        "Repo text outside manifest-declared package surface",
      ),
    );
  }

  return {
    scoredComponents,
    explicitOnlyComponents,
    unpackagedComponents,
    packageRoots: packageRoots.map((packageRoot) => relativePath(pluginRoot, packageRoot)),
  };
}

async function readInvocationPolicy(rootPath) {
  const policyPath = path.join(rootPath, "agents", "openai.yaml");
  if (!(await pathExists(policyPath))) {
    return {
      allowImplicitInvocation: true,
      path: null,
    };
  }

  try {
    const parsed = parseYamlDocument(await readText(policyPath));
    return {
      allowImplicitInvocation: parsed?.policy?.allow_implicit_invocation !== false,
      path: policyPath,
    };
  } catch {
    return {
      allowImplicitInvocation: true,
      path: policyPath,
    };
  }
}

export async function computeSkillBudget(skillRoot) {
  const skillPath = path.join(skillRoot, "SKILL.md");
  const content = await readText(skillPath);
  const parsed = parseFrontmatter(content);
  const name = parsed.data?.name || path.basename(skillRoot);
  const description = parsed.data?.description || "";
  const invocationPolicy = await readInvocationPolicy(skillRoot);

  const triggerComponents = invocationPolicy.allowImplicitInvocation ? [
    createComponent("skill-name", skillPath, estimateTokenCount(name), "Always-loaded skill identifier"),
    createComponent(
      "skill-description",
      skillPath,
      estimateTokenCount(description),
      "Always-loaded trigger description",
    ),
  ] : [];

  const invokeComponents = [
    createComponent("skill-file", skillPath, estimateTokenCount(content), "Loaded when the skill is invoked"),
  ];

  const deferredComponents = await computeDeferredComponents(skillRoot, [skillPath]);

  return {
    kind: "skill",
    method: invocationPolicy.allowImplicitInvocation ? "estimated-static" : "estimated-static-policy-aware",
    invocation_policy: {
      allow_implicit_invocation: invocationPolicy.allowImplicitInvocation,
      ...(invocationPolicy.path ? { path: invocationPolicy.path } : {}),
    },
    trigger_cost_tokens: {
      value: sumTokenCounts(triggerComponents),
      components: triggerComponents,
    },
    invoke_cost_tokens: {
      value: sumTokenCounts(invokeComponents),
      components: invokeComponents,
    },
    deferred_cost_tokens: {
      value: sumTokenCounts(deferredComponents),
      components: deferredComponents,
    },
  };
}

export async function computePluginBudget(pluginRoot, manifest) {
  const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
  const manifestContent = await readText(manifestPath);
  const skillDirs = manifest?.skills
    ? await discoverSkillDirs(pluginRoot, manifest.skills)
    : await discoverSkillDirs(pluginRoot, "./skills/");

  const triggerComponents = [
    createComponent(
      "plugin-description",
      manifestPath,
      estimateTokenCount(manifest?.description || ""),
      "Plugin marketplace summary",
    ),
    createComponent(
      "default-prompts",
      manifestPath,
      estimateTokenCount((manifest?.interface?.defaultPrompt || []).join("\n")),
      "Starter prompts visible in the UI",
    ),
  ];

  const invokeComponents = [
    createComponent("plugin-manifest", manifestPath, estimateTokenCount(manifestContent), "Manifest load cost"),
  ];
  const explicitOnlyComponents = [];
  const implicitSkills = [];
  const explicitOnlySkills = [];
  const skillPolicies = [];

  for (const skillDir of skillDirs) {
    const skillPath = path.join(skillDir, "SKILL.md");
    if (!(await pathExists(skillPath))) {
      continue;
    }
    const content = await readText(skillPath);
    const parsed = parseFrontmatter(content);
    const skillName = path.basename(skillDir);
    const invocationPolicy = await readInvocationPolicy(skillDir);
    skillPolicies.push({
      skillDir,
      skillName,
      allowImplicitInvocation: invocationPolicy.allowImplicitInvocation,
    });

    if (invocationPolicy.allowImplicitInvocation) {
      implicitSkills.push(skillName);
      triggerComponents.push(
        createComponent(
          `${skillName}-description`,
          skillPath,
          estimateTokenCount(parsed.data?.description || ""),
          "Skill trigger description exposed through the plugin",
        ),
      );
      invokeComponents.push(
        createComponent(
          `${skillName}-skill-file`,
          skillPath,
          estimateTokenCount(content),
          "Implicit skill invocation cost ceiling",
        ),
      );
    } else {
      explicitOnlySkills.push(skillName);
      explicitOnlyComponents.push(
        createComponent(
          `${skillName}-skill-file`,
          skillPath,
          estimateTokenCount(content),
          "Explicit-only skill file; excluded from implicit trigger/invoke budget",
        ),
      );
    }
  }

  const deferred = await computePluginDeferredComponents(pluginRoot, manifest, skillPolicies, [
    manifestPath,
    ...skillDirs.map((skillDir) => path.join(skillDir, "SKILL.md")),
  ]);

  return {
    kind: "plugin",
    method: explicitOnlySkills.length > 0 ? "estimated-static-package-and-policy-aware" : "estimated-static-package-aware",
    invocation_policy: {
      implicit_skill_count: implicitSkills.length,
      explicit_only_skill_count: explicitOnlySkills.length,
      implicit_skills: implicitSkills,
      explicit_only_skills: explicitOnlySkills,
    },
    package_surface: {
      roots: deferred.packageRoots,
    },
    trigger_cost_tokens: {
      value: sumTokenCounts(triggerComponents),
      components: triggerComponents,
    },
    invoke_cost_tokens: {
      value: sumTokenCounts(invokeComponents),
      components: invokeComponents,
    },
    deferred_cost_tokens: {
      value: sumTokenCounts(deferred.scoredComponents),
      components: deferred.scoredComponents,
    },
    explicit_only_invoke_cost_tokens: {
      value: sumTokenCounts(explicitOnlyComponents),
      components: explicitOnlyComponents,
    },
    explicit_only_deferred_cost_tokens: {
      value: sumTokenCounts(deferred.explicitOnlyComponents),
      components: deferred.explicitOnlyComponents,
    },
    unpackaged_text_tokens: {
      value: sumTokenCounts(deferred.unpackagedComponents),
      components: deferred.unpackagedComponents,
    },
  };
}

async function discoverSkillDirs(pluginRoot, skillsPath) {
  const directory = path.join(pluginRoot, skillsPath.replace(/^\.\//, ""));
  if (!(await isDirectory(directory))) {
    return [];
  }
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

export async function computeBudgetProfile(target) {
  if (target.kind === "skill") {
    return computeSkillBudget(target.path);
  }
  if (target.kind === "plugin") {
    const manifest = await readJson(path.join(target.path, ".codex-plugin", "plugin.json"));
    return computePluginBudget(target.path, manifest);
  }

  const files = await gatherDeferredTextFiles(target.path);
  const components = [];
  for (const filePath of files) {
    const content = await readText(filePath);
    components.push(
      createComponent(
        relativePath(target.path, filePath),
        filePath,
        estimateTokenCount(content),
        "Generic text file budget",
      ),
    );
  }
  return {
    kind: target.kind,
    trigger_cost_tokens: { value: 0, components: [] },
    invoke_cost_tokens: { value: 0, components: [] },
    deferred_cost_tokens: { value: sumTokenCounts(components), components },
  };
}

export function applyBudgetBands(rawBudget, baseline) {
  const profile = baseline?.[rawBudget.kind] || baseline?.directory || baseline?.skill;
  const trigger = buildBudgetBucket(
    rawBudget.trigger_cost_tokens.value,
    profile.trigger_cost_tokens,
    rawBudget.trigger_cost_tokens.components,
  );
  const invoke = buildBudgetBucket(
    rawBudget.invoke_cost_tokens.value,
    profile.invoke_cost_tokens,
    rawBudget.invoke_cost_tokens.components,
  );
  const deferred = buildBudgetBucket(
    rawBudget.deferred_cost_tokens.value,
    profile.deferred_cost_tokens,
    rawBudget.deferred_cost_tokens.components,
  );
  const explicitOnly = rawBudget.explicit_only_invoke_cost_tokens
    ? buildBudgetBucket(
        rawBudget.explicit_only_invoke_cost_tokens.value,
        profile.invoke_cost_tokens,
        rawBudget.explicit_only_invoke_cost_tokens.components,
      )
    : null;
  const explicitOnlyDeferred = rawBudget.explicit_only_deferred_cost_tokens
    ? buildBudgetBucket(
        rawBudget.explicit_only_deferred_cost_tokens.value,
        profile.deferred_cost_tokens,
        rawBudget.explicit_only_deferred_cost_tokens.components,
      )
    : null;
  const unpackagedText = rawBudget.unpackaged_text_tokens
    ? buildBudgetBucket(
        rawBudget.unpackaged_text_tokens.value,
        profile.deferred_cost_tokens,
        rawBudget.unpackaged_text_tokens.components,
      )
    : null;
  const total = trigger.value + invoke.value + deferred.value;
  return {
    method: rawBudget.method || "estimated-static",
    ...(rawBudget.invocation_policy ? { invocation_policy: rawBudget.invocation_policy } : {}),
    ...(rawBudget.package_surface ? { package_surface: rawBudget.package_surface } : {}),
    trigger_cost_tokens: trigger,
    invoke_cost_tokens: invoke,
    deferred_cost_tokens: deferred,
    ...(explicitOnly ? { explicit_only_invoke_cost_tokens: explicitOnly } : {}),
    ...(explicitOnlyDeferred ? { explicit_only_deferred_cost_tokens: explicitOnlyDeferred } : {}),
    ...(unpackagedText ? { unpackaged_text_tokens: unpackagedText } : {}),
    total_tokens: {
      value: total,
      band:
        [trigger.band, invoke.band, deferred.band].includes("excessive")
          ? "excessive"
          : [trigger.band, invoke.band, deferred.band].includes("heavy")
            ? "heavy"
            : [trigger.band, invoke.band, deferred.band].includes("moderate")
              ? "moderate"
              : "good",
    },
  };
}
