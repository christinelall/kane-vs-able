import { EscapeRoomGame } from "./game.js";

async function loadRoom() {
  const response = await fetch(`/rooms/current-room.json?ts=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Could not load room (${response.status}).`);
  return response.json();
}

const elements = {
  roomTitle: document.querySelector("#room-title"),
  roomDescription: document.querySelector("#room-description"),
  roomVersion: document.querySelector("#room-version"),
  exitSequence: document.querySelector("#exit-sequence"),
  exitRequirement: document.querySelector("#exit-requirement"),
  roomStage: document.querySelector("#room-stage"),
  inventory: document.querySelector("#inventory"),
  clues: document.querySelector("#clues"),
  exitCode: document.querySelector("#exit-code"),
  exitForm: document.querySelector("#exit-form"),
  activityLog: document.querySelector("#activity-log"),
  winOverlay: document.querySelector("#win-overlay"),
  toast: document.querySelector("#toast"),
  ableConfidence: document.querySelector("#able-confidence"),
  ableMessage: document.querySelector("#able-message"),
  confidenceNumber: document.querySelector("#confidence-number"),
  confidenceFill: document.querySelector("#confidence-fill"),
};

try {
  const room = await loadRoom();
  const game = new EscapeRoomGame(room, elements);
  game.start();
} catch (error) {
  console.error(error);
  elements.roomTitle.textContent = "Dungeon failed to load";
  elements.roomDescription.textContent = error.message;
}
