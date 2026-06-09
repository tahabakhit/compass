#!/usr/bin/env node

'use strict';

const path = require('path');
const { SINAN_EVENT_IDS } = require(path.join(__dirname, '..', 'contracts', 'events'));

const TOOL_MAP = Object.freeze({
  shell: 'Bash',
  bash: 'Bash',
  edit: 'Edit',
  write: 'Write',
  read: 'Read',
  glob: 'Glob',
  grep: 'Grep',
  agent: 'Agent',
});

const CODEX_EVENT_MAP = Object.freeze({
  SessionStart: SINAN_EVENT_IDS.SESSION_START,
  PreToolUse: SINAN_EVENT_IDS.PRE_TOOL,
  PermissionRequest: SINAN_EVENT_IDS.PERMISSION_REQUEST,
  PostToolUse: SINAN_EVENT_IDS.POST_TOOL,
  PreCompact: SINAN_EVENT_IDS.PRE_COMPACT,
  PostCompact: SINAN_EVENT_IDS.POST_COMPACT,
  UserPromptSubmit: SINAN_EVENT_IDS.USER_PROMPT,
  SubagentStart: SINAN_EVENT_IDS.SUBAGENT_START,
  SubagentStop: SINAN_EVENT_IDS.SUBAGENT_STOP,
  Stop: SINAN_EVENT_IDS.STOP,
});

const CLAUDE_EVENT_MAP = Object.freeze({
  SessionStart: SINAN_EVENT_IDS.SESSION_START,
  Setup: SINAN_EVENT_IDS.SETUP,
  PreToolUse: SINAN_EVENT_IDS.PRE_TOOL,
  PostToolUse: SINAN_EVENT_IDS.POST_TOOL,
  PostToolBatch: SINAN_EVENT_IDS.POST_TOOL_BATCH,
  PostToolUseFailure: SINAN_EVENT_IDS.POST_TOOL_FAILURE,
  UserPromptSubmit: SINAN_EVENT_IDS.USER_PROMPT_SUBMIT,
  UserPromptExpansion: SINAN_EVENT_IDS.USER_PROMPT_EXPANSION,
  Stop: SINAN_EVENT_IDS.STOP,
  StopFailure: SINAN_EVENT_IDS.STOP_FAILURE,
  SessionEnd: SINAN_EVENT_IDS.SESSION_END,
  PreCompact: SINAN_EVENT_IDS.PRE_COMPACT,
  PostCompact: SINAN_EVENT_IDS.POST_COMPACT,
  SubagentStart: SINAN_EVENT_IDS.SUBAGENT_START,
  SubagentStop: SINAN_EVENT_IDS.SUBAGENT_STOP,
  TeammateIdle: SINAN_EVENT_IDS.TEAMMATE_IDLE,
  PermissionRequest: SINAN_EVENT_IDS.PERMISSION_REQUEST,
  PermissionDenied: SINAN_EVENT_IDS.PERMISSION_DENIED,
  InstructionsLoaded: SINAN_EVENT_IDS.INSTRUCTIONS_LOADED,
  FileChanged: SINAN_EVENT_IDS.FILE_CHANGED,
  CwdChanged: SINAN_EVENT_IDS.CWD_CHANGED,
  ConfigChange: SINAN_EVENT_IDS.CONFIG_CHANGE,
  Elicitation: SINAN_EVENT_IDS.ELICITATION,
  ElicitationResult: SINAN_EVENT_IDS.ELICITATION_RESULT,
  Notification: SINAN_EVENT_IDS.NOTIFICATION,
  TaskCreated: SINAN_EVENT_IDS.TASK_CREATED,
  TaskCompleted: SINAN_EVENT_IDS.TASK_COMPLETED,
  WorktreeCreate: SINAN_EVENT_IDS.WORKTREE_CREATE,
  WorktreeRemove: SINAN_EVENT_IDS.WORKTREE_REMOVE,
});

function normalizeToolName(toolName) {
  if (!toolName) return 'Unknown';
  const lower = String(toolName).toLowerCase();
  return TOOL_MAP[lower] || toolName;
}

function normalizePathFields(toolInput) {
  const normalized = { ...(toolInput || {}) };
  if (typeof normalized.file_path === 'string') normalized.file_path = normalized.file_path.replace(/\\/g, '/');
  if (typeof normalized.path === 'string') normalized.path = normalized.path.replace(/\\/g, '/');
  return normalized;
}

function createEnvelope(runtime, nativeEventName, payload) {
  const eventMap = runtime === 'codex' ? CODEX_EVENT_MAP : CLAUDE_EVENT_MAP;
  const normalizedEventId = eventMap[nativeEventName] || nativeEventName || 'unknown';
  const toolName = normalizeToolName(payload.tool_name || payload.tool_type || payload.toolName || '');
  const toolInput = normalizePathFields(payload.tool_input || payload.toolInput || {});

  return {
    event_id: normalizedEventId,
    runtime,
    native_event_name: nativeEventName || null,
    timestamp: payload.timestamp || new Date().toISOString(),
    session_id: payload.session_id || null,
    turn_id: payload.turn_id || null,
    cwd: payload.cwd || null,
    transcript_path: payload.transcript_path || null,
    model: payload.model || null,
    tool_name: toolName,
    tool_input: toolInput,
    raw: payload,
  };
}

module.exports = Object.freeze({
  CODEX_EVENT_MAP,
  CLAUDE_EVENT_MAP,
  normalizeToolName,
  normalizePathFields,
  createEnvelope,
});
