import { SyllabusBase } from 'js/syllabus-base.js';
import { html } from 'js/html.js';

class SyllabusFixtures extends SyllabusBase {
  teamMap = new Map();

  connectedCallback() {
    const teamsBlock = this.querySelector('.fixtures-zone');
    this.drawsContainer = this.querySelector('.draw-dates-container');
    this.fixturesZone = this.querySelector('.fixtures-zone');

    const addDrawBtn = this.querySelector('.add-draw-btn');

    addDrawBtn.addEventListener('click', () => this.onAddDraw());
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

  openTeamPicker(clickedBtn) {
    if (this.teamMap.size < 1) return;

    const container = clickedBtn.closest('.team-picker-container');
    const hiddenInput = container.querySelector('.team-id-input');
    const popover = document.getElementById('global-team-picker');

    let popoverHtml = `<div class="team-popover">`;

    for (const [index, [key, { name }]] of Array.from(this.teamMap).entries()) {
      const teamName = name.trim() || 'Unnamed';
      popoverHtml += html`
        <button
          type="button"
          class="ui-button ui-ghost team-choice-btn"
          data-id="${key}"
          data-text="${this.gameButtonText(index, teamName)}"
        >
          <strong>Team ${index + 1}</strong>: ${teamName}
        </button>
      `;
    }

    popoverHtml += html`</div>`;

    popover.innerHTML = popoverHtml;

    // Position and show popover logic remains the same...
    const rect = clickedBtn.getBoundingClientRect();
    popover.style.position = 'absolute';
    popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
    popover.style.left = `${rect.left + window.scrollX}px`;

    popover.querySelectorAll('.team-choice-btn').forEach(choiceBtn => {
      choiceBtn.addEventListener('click', () => {
        hiddenInput.value = choiceBtn.dataset.id;
        clickedBtn.textContent = choiceBtn.dataset.text;
        clickedBtn.classList.remove('team-missing');

        popover.hidePopover();
      });
    });

    popover.showPopover();
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

    gameBlock.querySelectorAll('.team-picker-btn').forEach(btn => {
      btn.addEventListener('click', e => this.openTeamPicker(e.target));
    });

    // Attach any game-specific listeners here if not using delegation
    gameBlock.querySelector('.remove-game-btn').addEventListener('click', () => {
      gameBlock.remove();
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
  }

  // A shared, pure helper method inside or outside your class
  renderDrawBlock(drawData = null) {
    // If we have data, use its real ID. If not, generate a new temporary client ID.
    const id = drawData ? drawData.id : this.nextId();

    const drawBlock = document.createElement('div');
    drawBlock.className = 'draw-round-block';
    drawBlock.dataset.id = id; // Always bound to the container

    // Extract values or use empty fallbacks for fresh creation
    const dateValue = drawData ? drawData.date : '';
    const timeValue = drawData ? drawData.time : '';

    drawBlock.innerHTML = html`
      <div class="draw-round">
        <div>
          <label>Draw Date:</label><br />
          <input type="date" name="draw[${id}].date" value="${dateValue}" required />
        </div>
        <div>
          <label>Draw Time:</label><br />
          <input type="time" step="300" name="draw[${id}].time" value="${timeValue}" required />
        </div>
        <div>
          <button type="button" class="ui-button ui-filled add-game-btn">Add game</button>
        </div>

        <button type="button" class="remove-draw-btn">✕ Remove</button>
      </div>
      <div class="games-list-container">
        <!-- Games will be injected or appended here -->
      </div>
    `;

    // If we are hydrating existing games, append them now
    if (drawData && drawData.games) {
      const gamesContainer = drawBlock.querySelector('.games-list-container');
      drawData.games.forEach(gameData => {
        // You can call a similar shared renderGameBlock(gameData) here!
        const gameBlock = this.renderGameBlock(drawBlock, gameData);

        gamesContainer.appendChild(gameBlock);
      });
    }

    drawBlock.querySelector('.remove-draw-btn').addEventListener('click', () => {
      drawBlock.remove();
      this.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Listen directly on the button instead of the entire block to avoid accidental click triggers
    const addGameBtn = drawBlock.querySelector('.add-game-btn');
    addGameBtn.addEventListener('click', event => this.addGame(event));

    return drawBlock;
  }

  hydrate(jsonData) {
    this.drawsContainer.innerHTML = ''; // Clear existing session layout

    jsonData.fixtures.forEach(draw => {
      // 1. Build the main draw round block container
      const drawBlock = this.renderDrawBlock(draw);

      // // 2. Loop over this specific draw's child games array
      // if (draw.games && draw.games.length > 0) {
      //   // Find the specific wrapper inside your template where games belong
      //   const gamesList = drawBlock.querySelector('.games-list-container');
      //
      //   for (const game of draw.games) {
      //     // Build the game row, passing the draw block along so it can read its data-id
      //     const gameBlock = this.renderGameBlock(drawBlock, game);
      //     gamesList.appendChild(gameBlock);
      //   }
      // }

      // 3. Mount the fully populated block to the page
      this.drawsContainer.appendChild(drawBlock);
    });
  }
  onAddDraw() {
    const freshDrawBlock = this.renderDrawBlock(); // No arguments = defaults to creation
    this.drawsContainer.appendChild(freshDrawBlock);

    freshDrawBlock.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

customElements.define('syllabus-fixtures', SyllabusFixtures);
