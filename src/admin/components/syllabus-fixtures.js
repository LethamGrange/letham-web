import { SyllabusBase } from 'js/syllabus-base.js';
import { html } from 'js/html.js';

class SyllabusFixtures extends SyllabusBase {
  teamMap = new Map();

  // Dynamic getter to keep count of how many draws exist
  get currentDrawCount() {
    if (!this.drawsContainer) return 0;
    return this.drawsContainer.querySelectorAll('.draw-round-block').length;
  }

  connectedCallback() {
    if (typeof super.connectedCallback === 'function') {
      super.connectedCallback();
    }

    this.drawsContainer = this.querySelector('.draws-container');
    this.globalPopover = this.querySelector('[popover]');
    this.counterBadge = this.querySelector('.fixture-count-badge');

    this.addEventListener('click', event => {
      const pickerBtn = event.target.closest('.team-picker-btn');
      if (pickerBtn) {
        this.handleTeamPickerClick(event, pickerBtn);
        return;
      }
      // --- HANDLE ADDING A NEW DRAW ---
      const addDrawBtn = event.target.closest('.add-draw-btn');
      if (addDrawBtn) {
        event.stopPropagation();
        this.onAddDraw();
        return;
      }

      // --- HANDLE ADDING A GAME INSIDE A DRAW ---
      const addGameBtn = event.target.closest('.add-game-btn');
      if (addGameBtn) {
        event.stopPropagation();
        this.addGame(event);
        return;
      }

      const removeGameBtn = event.target.closest('.remove-game-btn');
      if (removeGameBtn) {
        const drawGame = event.target.closest('.draw-game');
        if (drawGame) {
          // Find the parent draw block first so we can reference it after deletion
          const drawRound = drawGame.closest('.draw-round-block');

          drawGame.remove();

          // Clean, reusable call:
          this.updateVisualGameLabels(drawRound);
          this.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      const removeDrawBtn = event.target.closest('.remove-draw-btn');
      if (removeDrawBtn) {
        event.stopPropagation();

        // Find the exact draw block wrapper this button belongs to
        const drawBlock = event.target.closest('.draw-round-block'); // or .draw-round-block based on your class names
        if (drawBlock) {
          drawBlock.remove();

          // Automatically re-calculate the sequential labels (Draw 1, Draw 2, etc.)
          this.updateVisualDrawLabels();

          // Alert the parent syllabus-builder that the form state has changed
          this.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      this.addEventListener('input', event => {
        // Check if the modified element is either the date or time input inside a draw
        const isDateTimeInput = event.target.matches('input[type="date"], input[type="time"]');
        if (!isDateTimeInput) return;

        const drawRound = event.target.closest('.draw-round');
        if (drawRound) {
          const dateInput = drawRound.querySelector('input[type="date"]');
          const timeInput = drawRound.querySelector('input[type="time"]');
          const summaryTitle = drawRound.querySelector('.nested-summary-title');

          if (summaryTitle) {
            const dateVal = dateInput?.value || '';
            const timeVal = timeInput?.value || '';

            // Instantly rewrite the main title with the fresh values
            summaryTitle.textContent = `Draw ${dateVal} ${timeVal} Games: `;
          }
        }
      });

      if (event.target.closest('.toggle-all-draws-btn')) {
        event.stopPropagation();

        const toggleBtn = event.target.closest('.toggle-all-draws-btn');
        const allDraws = Array.from(this.querySelectorAll('.draw-round'));
        if (allDraws.length === 0) return;

        // 1. Check if at least one drawer is currently expanded
        const anyOpen = allDraws.some(accordion => accordion.hasAttribute('open'));

        allDraws.forEach(accordion => {
          if (anyOpen) {
            // If anything is open, the goal is to collapse everything
            accordion.removeAttribute('open');
          } else {
            // If everything was closed, the goal is to expand everything
            accordion.setAttribute('open', '');
          }
        });

        // 2. Symmetrically switch the button text to show the NEXT available action
        toggleBtn.textContent = anyOpen ? 'Expand All' : 'Collapse All';
        return;
      }
      // Listen for native accordion toggles anywhere inside this component
      this.addEventListener(
        'toggle',
        event => {
          const isDrawRound = event.target.matches('.draw-round');
          if (!isDrawRound) return;

          // Re-run your button text checking block to see if it should say "Expand All" or "Collapse All"
          const toggleBtn = this.querySelector('.toggle-all-draws-btn');
          if (toggleBtn) {
            const allDraws = Array.from(this.querySelectorAll('.draw-round'));
            const anyOpen = allDraws.some(accordion => accordion.hasAttribute('open'));
            toggleBtn.textContent = anyOpen ? 'Collapse All' : 'Expand All';
          }
        },
        { capture: true },
      ); // Crucial: toggle events don't bubble, so capture handles delegation!
    });
  } // connectedCallback

  clear() {
    const ddc = this.querySelector('.draws-container');
    ddc.innerHTML = '';
    this.updateVisualDrawLabels();
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

        const expectedText = `${index + 1}: ${teamName}`;
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

  updateTeams(updatedTeams) {
    this.teamMap = new Map(updatedTeams.map((t, i) => [t.key, { name: t.name, index: i }]));

    this.updateAllFixtureDropdowns();
  }

  handleTeamPickerClick(e, pickerBtn) {
    e.stopPropagation();

    this.renderPopoverTeams(pickerBtn);
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

        if (pickerBtn) {
          const container = pickerBtn.closest('.team-picker-container');
          const hiddenInput = container.querySelector('input[type="hidden"]');

          hiddenInput.value = selectedKey;

          this.updateAllFixtureDropdowns(); // Re-generate the compact dashboard strings instantly with the new name!
          const drawRound = pickerBtn.closest('.draw-round');
          this.updateVisualGameLabels(drawRound);
          this.dispatchEvent(new Event('input', { bubbles: true }));
        }

        this.globalPopover.hidePopover();
      });
    });
    pickerBtn.style.setProperty('anchor-name', '--active-picker-target');
  }

  renderGameBlock(parentDrawBlock, gameData = null) {
    const drawId = parentDrawBlock.dataset?.id ?? parentDrawBlock;
    const data = gameData ?? {};

    const gameId = data.id ?? this.generateId();

    const gameBlock = document.createElement('div');
    gameBlock.className = 'draw-game';
    gameBlock.dataset.id = gameId; // Keep it uniform with drawBlock!

    // Pull existing hydration data or set up empty fields for a new game
    const teamA_Key = data.team_a ?? '';
    const teamB_Key = data.team_b ?? '';

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

    return gameBlock;
  }

  addGame(event) {
    event.preventDefault();
    const drawBlock = event.target.closest('.draw-round-block'); // or .draw-round / .nested-accordion-section depending on your class
    if (!drawBlock) return;

    const gamesList = drawBlock.querySelector('.games-container');
    const freshGame = this.renderGameBlock(drawBlock);
    gamesList.appendChild(freshGame);

    // Clean, reusable call:
    this.updateVisualGameLabels(drawBlock);
    this.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // A shared, pure helper method inside or outside your class
  renderDrawBlock(drawData = null) {
    const draw = drawData ?? {};
    const key = draw.id ?? this.generateId();

    const drawDiv = document.createElement('div');
    drawDiv.className = 'draw-round-block';
    drawDiv.dataset.id = key;

    const dateValue = draw.date ?? '';
    const timeValue = draw.time ?? '';

    drawDiv.innerHTML = html`<details class="ui-accordion ui-card draw-round" open>
      <summary class="nested-accordion-header" id="draw[${key}]-summary-id" aria-controls="draw[${key}]-content-id">
        <!-- Flex column keeps titles on top and the matchup previews sitting right below them -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div class="title-group">
            <span class="nested-summary-title">Draw ${dateValue} ${timeValue} Games: </span>
            <span class="count-pill game-count-badge">0</span>
          </div>

          <!-- This line populates dynamically via updateVisualGameLabels() -->
          <span
            class="compact-preview"
            style="font-size: var(--font-size-0); color: var(--text-2); font-weight: normal;"
          ></span>
        </div>

        <button type="button" class="remove-draw-btn">x Remove</button>
      </summary>
      <div
        id="draw[${key}]-content-id"
        class="ui-content accordion-content"
        role="region"
        aria-labelledby="draw[${key}]summary-id"
      >
        <div class="draw-round-details">
          <div>
            <label>Draw Date:</label><br />
            <input type="date" name="draw[${key}].date" value="${dateValue}" required />
          </div>
          <div>
            <label>Draw Time:</label><br />
            <input type="time" step="300" name="draw[${key}].time" value="${timeValue || '18:00'}" required />
          </div>
          <div>
            <button type="button" class="ui-button ui-filled add-game-btn">Add game</button>
          </div>
        </div>
        <div class="games-container">
          <!-- Game / Sheet entries will be appended here -->
        </div>
      </div>
    </details>`;

    if (drawData?.games) {
      const gamesContainer = drawDiv.querySelector('.games-container');
      drawData.games.forEach(gameData => {
        const gameBlock = this.renderGameBlock(drawDiv, gameData);
        gamesContainer.appendChild(gameBlock);
      });

      // Clean, reusable call:
      this.updateVisualGameLabels(drawDiv);
    }

    return drawDiv;
  }

  hydrate(jsonData) {
    // 1. SNAPSHOT: Read our own internal state before nuking the DOM
    const openStatesMap = new Map(
      Array.from(this.querySelectorAll('.draw-round-block')).map(block => [
        block.dataset.key,
        block.querySelector('.draw-round')?.hasAttribute('open') ?? false,
      ]),
    );

    // 2. PURGE & REBUILD: Run the standard data ingestion loop
    this.drawsContainer.innerHTML = '';

    jsonData.fixtures.forEach(data => {
      this.onAddDraw(data);
    });

    this.updateVisualDrawLabels();

    // 3. RESTORE: Cycle back through the new nodes and re-apply user view layouts
    this.querySelectorAll('.draw-round-block').forEach(block => {
      const wasOpen = openStatesMap.get(block.dataset.key);
      const accordion = block.querySelector('.draw-round');

      if (accordion) {
        if (wasOpen) {
          accordion.setAttribute('open', '');
        } else {
          accordion.removeAttribute('open'); // Fall back to closed if it wasn't open
        }
      }

      // Refresh the compact dashboard string text for this specific round
      this.updateVisualGameLabels(block);
    });

    // 4. SYNC HEADER ACTION: Force the macro toggle button to check the fresh screen environment
    const toggleBtn = this.querySelector('.toggle-all-draws-btn');
    if (toggleBtn) {
      const allDraws = Array.from(this.querySelectorAll('.draw-round'));
      const anyOpen = allDraws.some(acc => acc.hasAttribute('open'));
      toggleBtn.textContent = anyOpen ? 'Collapse All' : 'Expand All';
    }
  }
  updateVisualGameLabels(drawRound) {
    if (!drawRound) return;

    const gamesList = drawRound.querySelector('.games-container');
    const gameCounter = drawRound.querySelector('.game-count-badge');
    const previewSpan = drawRound.querySelector('.compact-preview');

    if (!gamesList || !gameCounter) return;

    // 1. Sync the raw badge counts
    const matches = gamesList.querySelectorAll('.draw-game'); // Or your designated single match row class
    gameCounter.textContent = matches.length;

    // 2. Generate the dashboard text summary string array dynamically
    if (previewSpan) {
      const previewStrings = Array.from(matches).map(row => {
        // Grab text labels straight from your layout selection picker buttons
        const buttons = row.querySelectorAll('.team-picker-btn');
        const teamAText = buttons[0]?.textContent || 'Select Team 1';
        const teamBText = buttons[1]?.textContent || 'Select Team 2';

        // Returns formatted layout segment text e.g., "[1]: Smith v [2]: Jones"
        return `[${teamAText}] v [${teamBText}]`;
      });

      // Join all games sequentially separated with clean spacing
      previewSpan.textContent = previewStrings.join('    ') || 'No matchups assigned yet.';
    }
  }
  updateVisualDrawLabels() {
    if (this.counterBadge) {
      this.counterBadge.textContent = this.currentDrawCount;
    }
    const toggleBtn = this.querySelector('.toggle-all-draws-btn');
    if (toggleBtn) {
      const allDraws = Array.from(this.querySelectorAll('.draw-round'));
      const anyOpen = allDraws.some(accordion => accordion.hasAttribute('open'));

      // Keep the macro button label text matching the actual state of the screen
      toggleBtn.textContent = anyOpen ? 'Collapse All' : 'Expand All';
    }
  }

  onAddDraw(drawData) {
    const draw = drawData ?? {};
    const key = draw.id ?? this.generateId();
    const name = draw.name ?? '';

    // 1. Locate the container's parent <details> section safely
    const accordionSection = this.drawsContainer.closest('.accordion-section');

    // 2. Ensure it has the "open" attribute so the new row is visible
    if (accordionSection && !accordionSection.hasAttribute('open')) {
      accordionSection.setAttribute('open', '');
    }

    const freshDrawBlock = this.renderDrawBlock(drawData); // No arguments = defaults to creation
    this.drawsContainer.appendChild(freshDrawBlock);
    if (!drawData) {
      this.updateVisualDrawLabels();
      this.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

customElements.define('syllabus-fixtures', SyllabusFixtures);
