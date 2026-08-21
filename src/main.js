import { EscapeRoomGame } from "./game.js";
import { chooseAbleReaction, getAbleProfile, inferAbleState, getDisplayConfidence } from "./able-character.js";
import { ableSpriteFor, kaneSpriteFor } from "./character-sprites.js";

const $ = (selector) => document.querySelector(selector);

const elements = {
  roomTitle: $("#room-title"),
  roomDescription: $("#room-description"),
  roomVersion: $("#room-version"),
  roomStage: $("#room-stage"),
  exitSequence: $("#exit-sequence"),
  ableConfidence: $("#able-confidence"),
  kaneStatus: $("#kane-status"),
  ableMessage: $("#able-message"),
  confidenceFill: $("#confidence-fill"),
  confidenceNumber: $("#confidence-number"),
  exitRequirement: $("#exit-requirement"),
  exitForm: $("#exit-form"),
  exitCode: $("#exit-code"),
  inventory: $("#inventory"),
  clues: $("#clues"),
  activityLog: $("#activity-log"),
  resetButton: $("#reset-game"),
  toast: $("#toast"),
  winOverlay: $("#win-overlay"),
  closeWin: $("#close-win"),
  verificationHistory: $("#verification-history"),
  beginDuel: $("#begin-duel"),
  resetDemo: $("#reset-demo"),
  duelPhase: $("#duel-phase"),
  duelMessage: $("#duel-message"),
  duelFeed: $("#duel-feed"),
  duelPulse: $("#duel-pulse"),
  discoveredCode: $("#discovered-code"),
  beforeGraph: $("#before-graph"),
  afterGraph: $("#after-graph"),
  beforeGraphLabel: $("#before-graph-label"),
  afterGraphLabel: $("#after-graph-label"),
  beforeGraphVerdict: $("#before-graph-verdict"),
  afterGraphVerdict: $("#after-graph-verdict"),
  ableAvatar: $("#able-avatar"),
  ableTitle: $("#able-title"),
  ableState: $("#able-state"),
  statVersions: $("#stat-versions"),
  statInitialConfidence: $("#stat-initial-confidence"),
  statLowestConfidence: $("#stat-lowest-confidence"),
  statAnomalies: $("#stat-anomalies"),
  statRepairs: $("#stat-repairs"),
  statAdmits: $("#stat-admits"),
  ableSprite: $("#able-sprite"),
  duelKaneSprite: $("#duel-kane-sprite"),
  duelAbleSprite: $("#duel-able-sprite"),
  kaneSpriteStatus: $("#kane-sprite-status"),
  ableSpriteStatus: $("#able-sprite-status"),
};

let currentRoom = null;
let lastHistoryFingerprint = "";
let latestHistory = [];
let currentDuelState = null;
let initialAbleConfidence = null;
let lowestAbleConfidence = null;
let confidenceGlitchTimer = null;

async function loadJson(path) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${path}${separator}t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
  return response.json();
}

async function postJson(path) {
  const response = await fetch(path, { method: "POST" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

async function boot() {
  await loadRoom();
  bindDuelControls();
  await Promise.all([refreshVerificationHistory(), refreshDuelState()]);
  setInterval(refreshVerificationHistory, 1800);
  setInterval(refreshDuelState, 900);
}

async function loadRoom() {
  try {
    const room = await loadJson("./rooms/current-room.json");
    currentRoom = room;
    if (initialAbleConfidence == null) {
      initialAbleConfidence = Number(room.able?.confidence ?? 50);
      lowestAbleConfidence = initialAbleConfidence;
    }
    const game = new EscapeRoomGame(room, elements);
    game.start();
  } catch (error) {
    console.error(error);
    elements.roomTitle.textContent = "Dungeon failed to load";
    elements.roomDescription.textContent = error.message;
  }
}

function bindDuelControls() {
  elements.beginDuel.addEventListener("click", async () => {
    try {
      elements.beginDuel.disabled = true;
      elements.duelPhase.textContent = "Starting duel…";
      await postJson("/api/duel");
      await refreshDuelState();
    } catch (error) {
      showToast(error.message);
      elements.beginDuel.disabled = false;
    }
  });

  elements.resetDemo.addEventListener("click", async () => {
    try {
      elements.resetDemo.disabled = true;
      await postJson("/api/demo-reset");
      window.location.reload();
    } catch (error) {
      showToast(error.message);
      elements.resetDemo.disabled = false;
    }
  });
}

async function refreshDuelState() {
  try {
    const state = await loadJson("/api/duel-state");
    renderDuelState(state);
  } catch (error) {
    console.warn(error);
  }
}

function renderDuelState(state) {
  currentDuelState = state;
  renderAbleCharacter(state, latestHistory);
  renderCharacterSprites(state, latestHistory);

  const phaseLabels = {
    idle: "Ready to duel",
    starting: "Duel starting",
    kane_running: "Kane is inside",
    kane_failed: "Kane found a blocker",
    able_repairing: "ABLE is repairing",
    room_repaired: "Dungeon evolved",
    kane_passed: "Kane escaped",
    complete: "Duel complete",
    awaiting_agent: "ABLE needs an agent",
    agent_error: "ABLE agent error",
    kane_error: "Kane infrastructure error",
    failed: "Duel unresolved",
    error: "Duel error",
  };

  elements.duelPhase.textContent = phaseLabels[state.phase] || state.phase || "Ready";
  elements.duelMessage.textContent = state.message || "";
  elements.beginDuel.disabled = Boolean(state.running);
  elements.resetDemo.disabled = Boolean(state.running);
  elements.beginDuel.classList.toggle("running", Boolean(state.running));
  elements.duelPulse.classList.toggle("inactive", !state.running);

  const dialogue = Array.isArray(state.dialogue) ? state.dialogue : [];
  if (!dialogue.length) {
    elements.duelFeed.innerHTML =
      '<div class="history-empty">Press BEGIN DUEL to start the argument.</div>';
    return;
  }

  elements.duelFeed.innerHTML = dialogue
    .slice()
    .reverse()
    .map((entry) => {
      const speakerClass = String(entry.speaker).toLowerCase();
      return `
        <article class="duel-line ${speakerClass} ${entry.status || "neutral"}">
          <div class="duel-speaker">${escapeHtml(entry.speaker)}</div>
          <p>${escapeHtml(entry.text)}</p>
        </article>
      `;
    })
    .join("");
}

async function refreshVerificationHistory() {
  try {
    const history = await loadJson("./verification/history.json");
    const normalized = Array.isArray(history) ? history : [];
    const fingerprint = JSON.stringify(
      normalized.map((entry) => [
        entry.attempt,
        entry.status,
        entry.roomVersion,
        entry.discoveredCode,
      ])
    );

    renderHistory(normalized);

    if (fingerprint !== lastHistoryFingerprint) {
      lastHistoryFingerprint = fingerprint;
      await refreshRoomIfChanged();
    }
  } catch (error) {
    elements.verificationHistory.innerHTML = `
      <div class="history-empty">
        Verification history is unavailable.<br />
        <small>${escapeHtml(error.message)}</small>
      </div>
    `;
  }
}

async function refreshRoomIfChanged() {
  try {
    const room = await loadJson("./rooms/current-room.json");
    if (currentRoom && room.version !== currentRoom.version) {
      window.location.reload();
    }
  } catch {
    // Keep current page if room refresh is momentarily unavailable.
  }
}

function renderHistory(history) {
  latestHistory = history;
  renderDiscoveredCode(history);
  renderBeforeAfterGraphs(history);
  renderAbleCharacter(currentDuelState, history);
  renderCharacterSprites(currentDuelState, history);
  renderAbleStats(history);

  if (history.length === 0) {
    elements.kaneStatus.textContent = "Awaiting verification";
    elements.kaneStatus.className = "";
    elements.verificationHistory.innerHTML =
      '<div class="history-empty">No Kane attempts yet.</div>';
    return;
  }

  const latest = history.at(-1);
  const latestPassed = latest.status === "passed";

  elements.kaneStatus.textContent = latestPassed
    ? `✓ SOLVABLE — attempt ${latest.attempt}`
    : `✕ BLOCKED — attempt ${latest.attempt}`;
  elements.kaneStatus.className = latestPassed ? "status-pass" : "status-fail";

  elements.verificationHistory.innerHTML = [...history]
    .reverse()
    .map((entry) => {
      const passed = entry.status === "passed";
      const timestamp = entry.timestamp
        ? new Date(entry.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      const metadata = [
        entry.duration != null ? `${entry.duration}s` : null,
        entry.discoveredCode ? `code ${entry.discoveredCode}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return `
        <article class="history-entry ${passed ? "pass" : "fail"}">
          <div class="history-topline">
            <span class="history-status">${passed ? "✓ PASSED" : "✕ FAILED"}</span>
            <span>Attempt ${entry.attempt}${timestamp ? ` · ${timestamp}` : ""}</span>
          </div>
          <p>${escapeHtml(entry.summary || entry.reason || "No summary returned.")}</p>
          ${metadata ? `<div class="history-meta">${escapeHtml(metadata)}</div>` : ""}
          ${
            entry.testUrl
              ? `<a href="${escapeAttribute(entry.testUrl)}" target="_blank" rel="noreferrer">Open Kane evidence ↗</a>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderDiscoveredCode(history) {
  const latestWithCode = [...history].reverse().find((entry) => entry.discoveredCode);
  const digits = latestWithCode
    ? String(latestWithCode.discoveredCode).replace(/\D/g, "").slice(0, 4).padEnd(4, "—").split("")
    : ["—", "—", "—", "—"];

  elements.discoveredCode.innerHTML = digits
    .map((digit) => `<span class="${digit !== "—" ? "revealed" : ""}">${escapeHtml(digit)}</span>`)
    .join("");
}

function renderBeforeAfterGraphs(history) {
  const failed = history.find((entry) => entry.status === "failed" && entry.graph);
  const passed = [...history].reverse().find((entry) => entry.status === "passed" && entry.graph);

  if (failed) {
    elements.beforeGraphLabel.textContent = `BEFORE · ATTEMPT ${failed.attempt}`;
    elements.beforeGraphVerdict.textContent = failed.graph.hasCycle
      ? "⚠ Circular dependency"
      : "Kane still found a blocker";
    elements.beforeGraphVerdict.className = "graph-fail";
    drawGraph(elements.beforeGraph, failed.graph);
  } else if (history.at(-1)?.graph) {
    const latest = history.at(-1);
    elements.beforeGraphLabel.textContent = `CURRENT · ATTEMPT ${latest.attempt}`;
    elements.beforeGraphVerdict.textContent = latest.graph.hasCycle
      ? "⚠ Cycle detected"
      : "No cycle detected";
    drawGraph(elements.beforeGraph, latest.graph);
  } else {
    clearGraph(elements.beforeGraph, "Kane has not captured a room snapshot yet.");
  }

  if (passed) {
    elements.afterGraphLabel.textContent = `AFTER · ATTEMPT ${passed.attempt}`;
    elements.afterGraphVerdict.textContent = "✓ Browser-verified path";
    elements.afterGraphVerdict.className = "graph-pass";
    drawGraph(elements.afterGraph, passed.graph);
  } else {
    elements.afterGraphVerdict.textContent = "Awaiting ABLE repair";
    elements.afterGraphVerdict.className = "";
    clearGraph(elements.afterGraph, "The repaired graph will appear after Kane re-verifies.");
  }
}

function clearGraph(svg, message) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const text = svgEl("text", {
    x: 260,
    y: 150,
    "text-anchor": "middle",
    class: "graph-empty-text",
  });
  text.textContent = message;
  svg.appendChild(text);
}

function drawGraph(svg, graph) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  if (!nodes.length) {
    clearGraph(svg, "No graph data.");
    return;
  }

  const defs = svgEl("defs");
  const marker = svgEl("marker", {
    id: `${svg.id}-arrow`,
    viewBox: "0 0 10 10",
    refX: 9,
    refY: 5,
    markerWidth: 6,
    markerHeight: 6,
    orient: "auto-start-reverse",
  });
  marker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "graph-arrow" }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const centerX = 260;
  const centerY = 150;
  const radiusX = 190;
  const radiusY = 105;
  const positions = new Map();

  nodes.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index / nodes.length) * Math.PI * 2;
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    });
  });

  const cycleNodes = new Set(graph.cycleNodeIds || []);

  for (const edge of edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;

    const line = svgEl("line", {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      class: cycleNodes.has(edge.from) && cycleNodes.has(edge.to)
        ? "graph-edge cycle"
        : "graph-edge",
      "marker-end": `url(#${svg.id}-arrow)`,
    });
    svg.appendChild(line);
  }

  for (const node of nodes) {
    const pos = positions.get(node.id);
    const group = svgEl("g", {
      class: `graph-node ${node.type} ${cycleNodes.has(node.id) ? "cycle" : ""}`,
      transform: `translate(${pos.x}, ${pos.y})`,
    });

    group.appendChild(
      svgEl("rect", {
        x: -56,
        y: -25,
        width: 112,
        height: 50,
        rx: 11,
      })
    );

    const icon = svgEl("text", { x: -43, y: 5, class: "graph-icon" });
    icon.textContent = node.icon || "";
    group.appendChild(icon);

    const label = svgEl("text", { x: -22, y: 4, class: "graph-node-label" });
    label.textContent = truncate(node.label, 15);
    group.appendChild(label);

    svg.appendChild(group);
  }
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function truncate(value, length) {
  const text = String(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}


function renderAbleCharacter(duelState, history = []) {
  if (!currentRoom) return;

  const stateName = inferAbleState(duelState || {}, history);
  const profile = getAbleProfile(stateName);
  const baseConfidence = Number(currentRoom.able?.confidence ?? 50);
  const displayConfidence = getDisplayConfidence(baseConfidence, stateName, history);

  lowestAbleConfidence =
    lowestAbleConfidence == null
      ? displayConfidence
      : Math.min(lowestAbleConfidence, displayConfidence);

  elements.ableAvatar.dataset.glyph = profile.avatar;
  elements.ableTitle.textContent = profile.title;
  elements.ableState.textContent = stateName.toUpperCase();
  elements.ableState.dataset.state = stateName;

  elements.confidenceFill.style.width = `${displayConfidence}%`;
  elements.confidenceNumber.textContent = `${displayConfidence}%`;
  elements.ableConfidence.textContent = `${displayConfidence}% confident`;

  const failedCount = history.filter((entry) => entry.status === "failed").length;
  let event = "duel_started";

  if (duelState?.phase === "kane_running") event = "kane_progress";
  if (duelState?.phase === "kane_failed") event = "kane_failed";
  if (duelState?.phase === "able_repairing") {
    event = failedCount >= 2 ? "multiple_repairs" : "repair_started";
  }
  if (duelState?.phase === "room_repaired") event = "repair_complete";
  if (duelState?.phase === "complete" || duelState?.phase === "kane_passed") event = "kane_passed";
  if (duelState?.phase === "awaiting_agent") event = "no_agent";

  const latest = history.at(-1);
  if (duelState?.phase === "kane_failed" && latest?.graph?.hasCycle) {
    event = "cycle_detected";
    triggerConfidenceGlitch(displayConfidence);
  }

  const reaction = chooseAbleReaction(
    event,
    (history.length * 7) + String(duelState?.phase || "").length
  );

  if (reaction) {
    elements.ableMessage.textContent = `“${reaction}”`;
  }
}

function triggerConfidenceGlitch(finalConfidence) {
  if (confidenceGlitchTimer) return;

  const values = [
    Math.min(99, finalConfidence + 45),
    Math.min(99, finalConfidence + 27),
    "ERR",
    Math.min(99, finalConfidence + 9),
    finalConfidence,
  ];
  let index = 0;

  elements.confidenceNumber.classList.add("glitching");

  confidenceGlitchTimer = setInterval(() => {
    const value = values[index];
    elements.confidenceNumber.textContent =
      typeof value === "number" ? `${value}%` : `${value}%`;
    elements.confidenceFill.style.width =
      typeof value === "number" ? `${value}%` : "18%";

    index += 1;
    if (index >= values.length) {
      clearInterval(confidenceGlitchTimer);
      confidenceGlitchTimer = null;
      elements.confidenceNumber.textContent = `${finalConfidence}%`;
      elements.confidenceFill.style.width = `${finalConfidence}%`;
      setTimeout(() => elements.confidenceNumber.classList.remove("glitching"), 500);
    }
  }, 180);
}

function renderCharacterSprites(duelState, history = []) {
  if (!currentRoom) return;

  const ableState = inferAbleState(duelState || {}, history);
  const able = ableSpriteFor(ableState);
  const kane = kaneSpriteFor(duelState || {}, history);

  setSprite(elements.ableSprite, able.src, `ABLE — ${able.label}`);
  setSprite(elements.duelAbleSprite, able.src, `ABLE — ${able.label}`);
  setSprite(elements.duelKaneSprite, kane.src, `Kane — ${kane.label}`);

  if (elements.ableSpriteStatus) elements.ableSpriteStatus.textContent = able.label.toUpperCase();
  if (elements.kaneSpriteStatus) elements.kaneSpriteStatus.textContent = kane.label.toUpperCase();

  const ableFrame = elements.duelAbleSprite?.closest(".duel-sprite-frame");
  const kaneFrame = elements.duelKaneSprite?.closest(".duel-sprite-frame");

  if (ableFrame) ableFrame.dataset.spriteState = able.key;
  if (kaneFrame) kaneFrame.dataset.spriteState = kane.key;
  if (elements.ableAvatar) elements.ableAvatar.dataset.spriteState = able.key;
}

function setSprite(image, src, alt) {
  if (!image) return;
  const desired = new URL(src, window.location.href).href;
  if (image.src !== desired) image.src = src;
  image.alt = alt;
}

function renderAbleStats(history) {
  if (!currentRoom) return;

  const failed = history.filter((entry) => entry.status === "failed");
  const passed = history.filter((entry) => entry.status === "passed");
  const versions = new Set(
    history.map((entry) => entry.roomVersion).filter(Boolean)
  );

  if (currentRoom.version) versions.add(currentRoom.version);

  elements.statVersions.textContent = Math.max(1, versions.size);
  elements.statInitialConfidence.textContent =
    initialAbleConfidence == null ? "—" : `${initialAbleConfidence}%`;
  elements.statLowestConfidence.textContent =
    lowestAbleConfidence == null ? "—" : `${lowestAbleConfidence}%`;
  elements.statAnomalies.textContent = failed.length;
  elements.statRepairs.textContent = Math.max(
    0,
    Math.min(failed.length, Math.max(0, versions.size - 1))
  );
  elements.statAdmits.textContent = "0";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  setTimeout(() => elements.toast.classList.remove("visible"), 2400);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

boot();
