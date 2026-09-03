import { SyllabusBase } from 'js/syllabus-base.js';
import { html } from 'js/html.js';

class SyllabusFixtures extends SyllabusBase {
  teamMap = new Map();

  // Dynamic getter to keep count of how many draws exist
  get currentDrawCount() {
    if (!this.drawsContainer) return 0;
    //    return this.drawsContainer.querySelectorAll('.nested-accordion-section').length;
    return this.drawsContainer.querySelectorAll('.draw-round-block').length;
  }

  connectedCallback() {
    if (typeof super.connectedCallback === 'function') {
      super.connectedCallback();
    }

    const teamsBlock = this.querySelector('.fixtures-zone');
    this.drawsContainer = this.querySelector('.draw-dates-container');
    this.fixturesZone = this.querySelector('.fixtures-zone');
    this.globalPopover = this.querySelector('[popover]');
    this.counterBadge = this.querySelector('.fixture-count-badge');

    const addDrawBtn = this.querySelector('.add-draw-btn');

    addDrawBtn.addEventListener('click', () => this.onAddDraw()); // Listen for clicks on team buttons to fire open the global popover

    this.addEventListener('click', e => {
      const pickerBtn = e.target.closest('.team-picker-btn');
      if (!pickerBtn) return;

      this.handleTeamPickerClick(e);
    });
  } // connectedCallback

  nextId() {
    return this.generateId();
  }

  clear() {
    const ddc = this.querySelector('.draw-dates-container');
    ddc.innerHTML = '';
  }

  updateAllFixtureDropdowns() {
    // Loop through the wrappers so we handle pairs together
    const selectWrappers = this.querySelectorAll('.team-picker-container');

    selectWrappers.forEach(wrapper => {
      const hiddenInput = wrapper.querySelector('input[type="hidden"]');
      const button = wrapper.querySelector('.team-picker-btn');

      // Read the key straight from the hidden input's current value
      const selectedTeamKey = hiddenInput.value;

      // Skip wrappers that haven't had a team selected yet
      if (!selectedTeamKey) return;
      if (this.teamMap.has(selectedTeamKey)) {
        const { name, index } = this.teamMap.get(selectedTeamKey);

        const teamName = name || 'Unnamed';

        const expectedText = this.gameButtonText(index, teamName);

        // Only touch the DOM if the index or name actually changed
        if (button.textContent !== expectedText) {
          button.textContent = expectedText;
        }
        button.classList.remove('team-missing');
      } else {
        // The team was deleted!
        button.textContent = '⚠️ Team Deleted';
        button.classList.add('team-missing');

        // Note: We leave hiddenInput.value alone so the server still knows
        // WHICH old key was deleted if it needs to process validation.
      }
    });
  }

  gameButtonText(index, teamName) {
    return `${index + 1}: ${teamName}`;
  }

  updateTeams(updatedTeams) {
    this.teamMap = new Map(updatedTeams.map((t, i) => [t.key, { name: t.name, index: i }]));

    this.updateAllFixtureDropdowns();
  }

  handleTeamPickerClick(e) {
    const pickerBtn = e.target.closest('.team-picker-btn');
    if (!pickerBtn) return;

    e.stopPropagation();

    // 1. Keep a temporary reference to the button that spawned this popup
    this.activePickerTarget = pickerBtn;

    // 2. Render the current teams list inside the popover from your cached map
    this.renderPopoverTeams(pickerBtn);

    // 3. Anchor the popover visually next to the clicked button using the modern Popover target property
    this.globalPopover.showPopover();
  }

  renderPopoverTeams(pickerBtn) {
    if (!this.globalPopover) return;

    // Re-generate list items from your teamMap state
    let targetHtml = '';
    this.teamMap.forEach((value, key) => {
      targetHtml += this.html`
      <button type="button" class="popover-selection-btn" data-team-key="${key}">
        ${value.index + 1}: ${value.name || 'Unnamed Team'}
      </button>
    `;
    });

    this.globalPopover.innerHTML =
      targetHtml || '<p style="color:var(--text-2); font-size:var(--font-size-0)">No teams created yet.</p>';

    // Catch selection choices instantly
    this.globalPopover.querySelectorAll('.popover-selection-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedKey = btn.dataset.teamKey;

        if (this.activePickerTarget) {
          // Find the hidden input sibling next to our active button wrapper and swap the values
          const container = pickerBtn.closest('.team-picker-container');
          const hiddenInput = container.querySelector('input[type="hidden"]');

          hiddenInput.value = selectedKey;

          // Refresh the text display states globally
          this.updateAllFixtureDropdowns();
          this.dispatchEvent(new Event('input', { bubbles: true }));
        }

        this.globalPopover.hidePopover();
      });
    });

    // Position and show popover logic remains the same...
    const rect = pickerBtn.getBoundingClientRect();
    this.globalPopover.style.top = `${rect.bottom + window.scrollY + 4}px`;
    this.globalPopover.style.left = `${rect.left + window.scrollX}px`;
  }

  renderGameBlock(parentDrawBlock, gameData = null) {
    // Extract the draw ID from the parent block's dataset
    const drawId = parentDrawBlock.dataset?.id ?? parentDrawBlock;

    // Use the database ID or generate a fresh client-side session game counter ID
    const gameId = gameData ? gameData.id : this.nextId();

    const gameBlock = document.createElement('div');
    gameBlock.className = 'draw-game';
    gameBlock.dataset.id = gameId; // Keep it uniform with drawBlock!

    // Pull existing hydration data or set up empty fields for a new game
    const teamA_Key = gameData ? gameData.team_a : '';
    const teamB_Key = gameData ? gameData.team_b : '';

    // Look up current visual names from your internal memory cache if hydrating
    const teamA_Name = teamA_Key ? this.teamMap.get(teamA_Key)?.name || 'Unknown' : '-- Team --';
    const teamB_Name = teamB_Key ? this.teamMap.get(teamB_Key)?.name || 'Unknown' : '-- Team --';

    gameBlock.innerHTML = html`
      <div class="team-picker-container">
        <input
          type="hidden"
          name="draw[${drawId}].game[${gameId}].team_a"
          value="${teamA_Key}"
          class="team-id-input"
          required
        />
        <button type="button" class="ui-button ui-outline team-picker-btn">${teamA_Name}</button>
      </div>
      <span> vs </span>
      <div class="team-picker-container">
        <input
          type="hidden"
          name="draw[${drawId}].game[${gameId}].team_b"
          value="${teamB_Key}"
          class="team-id-input"
          required
        />
        <button type="button" class="ui-button ui-outline team-picker-btn">${teamB_Name}</button>
      </div>
      <button type="button" class="remove-game-btn">✕</button>
    `;

    // Attach any game-specific listeners here if not using delegation
    gameBlock.querySelector('.remove-game-btn').addEventListener('click', () => {
      gameBlock.remove();
      const gamesList = parentDrawBlock.querySelector('.games-list-container');

      const gameCounter = parentDrawBlock.querySelector('.game-count-badge');
      gameCounter.textContent = gamesList.children.length;

      this.dispatchEvent(new Event('input', { bubbles: true }));
    });

    return gameBlock;
  }

  addGame(event) {
    event.preventDefault();
    const drawBlock = event.target.closest('.draw-round-block');
    if (!drawBlock) return;

    const gamesList = drawBlock.querySelector('.games-list-container');

    // Call the shared function with no game data—it instantly drops a fresh row!
    const freshGame = this.renderGameBlock(drawBlock);
    gamesList.appendChild(freshGame);

    const gameCounter = drawBlock.querySelector('.game-count-badge');
    gameCounter.textContent = gamesList.children.length;
  }

  // A shared, pure helper method inside or outside your class
  renderDrawBlock(drawData = null) {
    const draw = drawData ?? {};
    const key = draw.id ?? this.generateId();

    const drawDiv = document.createElement('div');
    drawDiv.className = 'draw-round-block nested-accordion-section';
    drawDiv.dataset.id = key; // Always bound to the container

    // Extract values or use empty fallbacks for fresh creation
    const dateValue = draw.date ?? '';
    const timeValue = draw.time ?? '';

    drawDiv.innerHTML = html`<details class="ui-accordion ui-card draw-round" open>
      <summary class="nested-accordion-header" id="draw[${key}]-summary-id" aria-controls="draw[${key}]-content-id">
        <div class="title-group">
          <span class="nested-summary-title">Draw ${dateValue} ${timeValue} Games: </span>
          <span class="count-pill game-count-badge">0</span>
        </div>
        <button
          type="button"
          class="remove-draw-btn"
          style="background:none; border:none; color:var(--red-6); cursor:pointer;"
        >
          x Remove
        </button>
      </summary>
      <div
        id="draw[${key}]-content-id"
        class="ui-content accordion-content draw-dates-container"
        role="region"
        aria-labelledby="draw[${key}]summary-id"
      >
        <div class="draw-round">
          <div>
            <label>Draw Date:</label><br />
            <input type="date" name="draw[${key}].date" value="${dateValue}" required />
          </div>
          <div>
            <label>Draw Time:</label><br />
            <input type="time" step="300" name="draw[${key}].time" value="${timeValue}" required />
          </div>
          <div>
            <button type="button" class="ui-button ui-filled add-game-btn">Add game</button>
          </div>
        </div>
        <div class="nested-accordion-content games-container games-list-container">
          <!-- Game / Sheet entries will be appended here -->
        </div>

        <div class="draw-dates-container"></div>
      </div>
    </details>`;

    // If we are hydrating existing games, append them now
    if (drawData && drawData.games) {
      const gamesContainer = drawDiv.querySelector('.games-list-container');
      drawData.games.forEach(gameData => {
        // You can call a similar shared renderGameBlock(gameData) here!
        const gameBlock = this.renderGameBlock(drawDiv, gameData);

        gamesContainer.appendChild(gameBlock);
      });

      const gameCounter = drawDiv.querySelector('.game-count-badge');
      gameCounter.textContent = gamesContainer.children.length;
    }

    drawDiv.querySelector('.remove-draw-btn').addEventListener('click', () => {
      drawDiv.remove();
      this.updateVisuals();
    });

    // Listen directly on the button instead of the entire block to avoid accidental click triggers
    const addGameBtn = drawDiv.querySelector('.add-game-btn');
    addGameBtn.addEventListener('click', event => this.addGame(event));

    return drawDiv;
  }

  hydrate(jsonData) {
    this.drawsContainer.innerHTML = ''; // Clear existing session layout

    jsonData.fixtures.forEach(data => {
      this.onAddDraw(data);
    });

    this.updateVisuals();
  }

  updateVisualDrawLabels() {
    // const draws = this.drawsContainer.querySelectorAll('.nested-accordion-section');
    // draws.forEach((draw, index) => {
    //   const title = draw.querySelector('.nested-summary-title');
    //   if (title) title.textContent = `Draw ${index + 1}`;
    // });

    // 2. Read straight from your live getter to update the pill badge!
    if (this.counterBadge) {
      this.counterBadge.textContent = this.currentDrawCount;
    }
  }

  updateVisuals() {
    this.updateVisualDrawLabels();

    this.dispatchEvent(new Event('input', { bubbles: true }));
  }

  onAddDraw(drawData) {
    const draw = drawData ?? {};
    const key = draw.id ?? this.generateId();
    const name = draw.name ?? '';

    const freshDrawBlock = this.renderDrawBlock(drawData); // No arguments = defaults to creation
    this.drawsContainer.appendChild(freshDrawBlock);
    if (!drawData) this.updateVisuals();
  }
}

customElements.define('syllabus-fixtures', SyllabusFixtures);
