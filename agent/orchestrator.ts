/**
 * Orchestration Module
 *
 * Coordinates the full skill mining cycle:
 * 1. Gather data from git and filesystem
 * 2. Analyze for patterns
 * 3. Store patterns in memory
 * 4. Generate skills from high-confidence patterns
 */

import type Database from "better-sqlite3";
import { join } from "node:path";
import {
  collectGitActivity,
  collectFileModifications,
  analyzeGitPatterns,
  analyzeFilePatterns,
  computeConfidence,
  type WorkPattern,
} from "./collector.js";
import {
  generateSkillFromPattern,
  type SkillContent,
} from "./skill-generator.js";
import {
  upsertPattern,
  insertSkill,
  type DetectedPattern,
  type GeneratedSkill,
} from "./memory.js";

// ─── Interfaces ───────────────────────────────────────────────────────────

export interface CycleResult {
  patternsDetected: number;
  patternsStored: number;
  skillsGenerated: number;
  newSkills: Array<{ name: string; filePath: string; confidence: number }>;
  gitCommits: number;
  filesScanned: number;
}

// ─── Main Orchestration ───────────────────────────────────────────────────

/**
 * Run a complete skill mining cycle.
 * Returns statistics about what was discovered and generated.
 */
export async function runCycle(
  db: Database.Database,
  agentDir: string,
  currentCycle: number,
  options: {
    confidenceThreshold?: number;
    sinceDaysAgo?: number;
    maxCommits?: number;
  } = {},
): Promise<CycleResult> {
  const {
    confidenceThreshold = 0.5,
    sinceDaysAgo = 30,
    maxCommits = 100,
  } = options;

  const result: CycleResult = {
    patternsDetected: 0,
    patternsStored: 0,
    skillsGenerated: 0,
    newSkills: [],
    gitCommits: 0,
    filesScanned: 0,
  };

  // Step 1: Collect data
  const gitActivities = collectGitActivity(agentDir, sinceDaysAgo, maxCommits);
  result.gitCommits = gitActivities.length;

  const fileModifications = collectFileModifications(agentDir);
  result.filesScanned = fileModifications.length;

  // Step 2: Analyze patterns
  const gitPatterns = analyzeGitPatterns(gitActivities);
  const filePatterns = analyzeFilePatterns(fileModifications);
  const allPatterns = [...gitPatterns, ...filePatterns];
  result.patternsDetected = allPatterns.length;

  // Step 3: Store patterns in memory
  const skillsDir = join(agentDir, "data", "skills");

  for (const pattern of allPatterns) {
    const confidence = computeConfidence(pattern.frequency);
    const patternId = generatePatternId(pattern);
    const suggestedSkillName = generateSkillNameFromPattern(pattern);

    const detectedPattern: DetectedPattern = {
      id: patternId,
      name: formatPatternName(pattern),
      frequency: pattern.frequency,
      dominantContentType: pattern.contentType,
      commonStyleAttrs: pattern.styleAttributes,
      suggestedSkillName,
      confidence,
      firstSeenCycle: currentCycle,
      lastSeenCycle: currentCycle,
    };

    upsertPattern(db, detectedPattern);
    result.patternsStored++;

    // Step 4: Generate skills for high-confidence patterns
    if (confidence >= confidenceThreshold) {
      try {
        const { name, filePath, content } = generateSkillFromPattern(
          pattern,
          skillsDir,
        );

        const skill: GeneratedSkill = {
          id: `skill-${name}`,
          name,
          filePath,
          sourcePatternId: patternId,
          createdCycle: currentCycle,
          commitSha: null, // Will be updated after commit
        };

        insertSkill(db, skill);
        result.skillsGenerated++;
        result.newSkills.push({ name, filePath, confidence });
      } catch (error) {
        // Log error but continue processing other patterns
        console.error(`Failed to generate skill for pattern ${patternId}:`, error);
      }
    }
  }

  return result;
}

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Generate a stable ID for a pattern based on its characteristics.
 */
function generatePatternId(pattern: WorkPattern): string {
  const typePrefix = pattern.type.substring(0, 3);
  const contentHash = pattern.contentType.toLowerCase().replace(/[^a-z0-9]/g, "");
  const styleHash = Object.keys(pattern.styleAttributes)
    .sort()
    .join("-")
    .replace(/[^a-z0-9-]/g, "");

  return `${typePrefix}-${contentHash}-${styleHash}`.substring(0, 64);
}

/**
 * Generate a skill name from a pattern (simplified version for pattern storage).
 */
function generateSkillNameFromPattern(pattern: WorkPattern): string {
  switch (pattern.type) {
    case "git-commit-style":
      return `git-${pattern.styleAttributes.prefix || "commit"}-commit`;
    case "file-type-usage":
      return `work-with-${pattern.contentType}-files`;
    case "file-modification-cluster":
      return `modify-${pattern.contentType}-files`;
    default:
      return "generic-work-pattern";
  }
}

/**
 * Format a human-readable name for a pattern.
 */
function formatPatternName(pattern: WorkPattern): string {
  switch (pattern.type) {
    case "git-commit-style": {
      const prefix = pattern.styleAttributes.prefix || "commit";
      return `${prefix.toUpperCase()} Commit Style`;
    }
    case "file-type-usage":
      return `${pattern.contentType.toUpperCase()} File Modifications (Git)`;
    case "file-modification-cluster":
      return `${pattern.contentType.toUpperCase()} File Cluster (Filesystem)`;
    default:
      return "Generic Work Pattern";
  }
}
