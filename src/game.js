export class EscapeRoomGame {
  constructor(room, elements) {
    this.room = room;
    this.el = elements;
    this.inventory = new Map();
    this.clues = new Map();
    this.inspected = new Set();
    this.won = false;
  }

  start() {
    this.renderRoomMeta();
    this.renderObjects();
    this.renderState();
    this.bindExit();
    this.bindReset();
    this.log("Kane enters the room. ABLE is already smug.", "neutral");
  }

  renderRoomMeta() {
    this.el.roomTitle.textContent = this.room.name;
    this.el.roomDescription.textContent = this.room.description;
    this.el.roomVersion.textContent = `ROOM ${this.room.version}`;
    this.el.exitSequence.textContent = this.room.exit.sequence
      .map((part) => part.toUpperCase())
      .join(" → ");

    const confidence = Number(this.room.able?.confidence ?? 50);
    this.el.ableConfidence.textContent = `${confidence}% solvable`;
    this.el.ableMessage.textContent = `“${this.room.able?.message ?? "I made a room."}”`;
    this.el.confidenceNumber.textContent = `${confidence}%`;
    this.el.confidenceFill.style.width = `${Math.max(0, Math.min(100, confidence))}%`;

    const required = this.room.exit.requires;
    this.el.exitRequirement.textContent = required
      ? `A ${required.name} must be fitted before the keypad will accept a code.`
      : "The keypad is active.";
  }

  renderObjects() {
    this.el.roomStage.innerHTML = "";

    for (const object of this.room.objects) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "room-object";
      button.dataset.objectId = object.id;
      button.setAttribute("aria-label", `Inspect ${object.name}`);

      button.innerHTML = `
        <span class="object-icon" aria-hidden="true">${object.icon ?? "◈"}</span>
        <span class="object-name">${object.name}</span>
        <span class="object-description">${object.description ?? "It looks suspicious."}</span>
        <span class="object-state" data-state-for="${object.id}">UNINSPECTED</span>
      `;

      button.addEventListener("click", () => this.inspect(object, button));
      this.el.roomStage.appendChild(button);
    }
  }

  inspect(object, button) {
    if (this.won) return;

    const requirement = object.requires;
    if (requirement && !this.inventory.has(requirement.id)) {
      this.log(
        `${object.name} is locked. It requires ${requirement.name}, which Kane does not have.`,
        "failed"
      );
      this.flash(button, "blocked");
      this.setObjectState(button, `LOCKED — NEEDS ${requirement.name.toUpperCase()}`);
      return;
    }

    if (this.inspected.has(object.id)) {
      this.log(`${object.name} has already given up everything useful.`, "neutral");
      this.flash(button, "visited");
      return;
    }

    this.inspected.add(object.id);
    this.flash(button, "visited");
    this.setObjectState(button, "INSPECTED");

    this.log(object.reveal ?? `Kane inspects ${object.name}.`, "passed");

    const gifts = Array.isArray(object.gives)
      ? object.gives
      : object.gives
        ? [object.gives]
        : [];

    for (const item of gifts) {
      if (!this.inventory.has(item.id)) {
        this.inventory.set(item.id, item);
        this.log(`Collected ${item.icon ?? "◆"} ${item.name}.`, "passed");
      }
    }

    if (object.clue && !this.clues.has(object.clue.id)) {
      this.clues.set(object.clue.id, object.clue);
      this.log(`Clue found: ${object.clue.text}`, "passed");
    }

    this.renderState();
  }

  bindExit() {
    this.el.exitCode.addEventListener("input", (event) => {
      event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
    });

    this.el.exitForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.tryEscape();
    });
  }

  tryEscape() {
    if (this.won) return;

    const required = this.room.exit.requires;
    if (required && !this.inventory.has(required.id)) {
      this.log(
        `The exit rejects Kane. The ${required.name} is missing, so the keypad cannot unlock the door.`,
        "failed"
      );
      this.toast(`Missing: ${required.name}`);
      return;
    }

    const code = this.el.exitCode.value.trim();
    if (code.length !== 4) {
      this.log("The lock expects exactly four digits.", "failed");
      this.toast("Enter all four digits.");
      return;
    }

    if (code === String(this.room.exit.code)) {
      this.won = true;
      this.log("The lock opens. Kane has proved the dungeon is solvable.", "passed");
      this.el.winOverlay.hidden = false;
      this.toast("KANE ESCAPED");
    } else {
      this.log(`Code ${code} is rejected by the final lock.`, "failed");
      this.toast("Wrong code.");
    }
  }

  bindReset() {
    this.el.resetButton.addEventListener("click", () => window.location.reload());
    this.el.closeWin.addEventListener("click", () => {
      this.el.winOverlay.hidden = true;
    });
  }

  renderState() {
    if (this.inventory.size === 0) {
      this.el.inventory.innerHTML = '<span class="empty-state">Nothing yet.</span>';
    } else {
      this.el.inventory.innerHTML = [...this.inventory.values()]
        .map(
          (item) =>
            `<span class="inventory-chip">${item.icon ?? "◆"} ${escapeHtml(item.name)}</span>`
        )
        .join("");
    }

    if (this.clues.size === 0) {
      this.el.clues.innerHTML =
        '<span class="empty-state">The room is keeping its secrets.</span>';
    } else {
      this.el.clues.innerHTML = [...this.clues.values()]
        .map(
          (clue) => `
            <div class="clue-chip">
              <span>${escapeHtml(clue.label ?? clue.id)}</span>
              <strong>${escapeHtml(clue.text)}</strong>
            </div>
          `
        )
        .join("");
    }
  }

  setObjectState(button, text) {
    const state = button.querySelector(".object-state");
    if (state) state.textContent = text;
  }

  flash(button, className) {
    button.classList.remove("blocked", "visited");
    void button.offsetWidth;
    button.classList.add(className);
  }

  log(message, status = "neutral") {
    const row = document.createElement("div");
    row.className = `log-row ${status}`;
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    row.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-indicator">${status === "passed" ? "✓" : status === "failed" ? "!" : "·"}</span>
      <span>${escapeHtml(message)}</span>
    `;

    this.el.activityLog.prepend(row);
  }

  toast(message) {
    this.el.toast.textContent = message;
    this.el.toast.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.el.toast.classList.remove("visible");
    }, 2200);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
