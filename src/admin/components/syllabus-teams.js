import { SyllabusBase } from 'js/syllabus-base.js';
import { html } from 'js/html.js';

class SyllabusTeams extends SyllabusBase {
  currentTeamCount = 0;

  connectedCallback() {
    const teamsBlock = this.querySelector('.teams-zone');

    this.teamsContainer = this.querySelector('.teams-input-container');

    const addTeamBtn = this.querySelector('.add-team-btn');
    addTeamBtn.addEventListener('click', () => this.onAddTeam());
  } // connectedCallback

  updateVisualTeamLabels() {
    // Grab all active labels currently inside the teams container
    const labels = this.teamsContainer.querySelectorAll('.team-number-label');

    labels.forEach((label, index) => {
      // index is 0-based, so add 1 for user presentation (Team 1, Team 2, etc.)
      label.textContent = `Team ${index + 1} Name:`;
    });
  }

  dispatchTeamsUpdate() {
    // querySelectorAll preserves the exact DOM/visual order
    const cards = this.querySelectorAll('.team-entry-card');

    const currentTeams = Array.from(cards).map(card => {
      const input = card.querySelector('.team-name');
      return {
        key: card.dataset.key, // e.g., "new_4"
        name: input.value, // e.g., "Smith or Forfar"
      };
    });

    this.dispatchEvent(
      new CustomEvent('teams-changed', {
        bubbles: true,
        composed: true,
        detail: { teams: currentTeams }, // Passes [{key: "new_4", name: "Forfar"}, ...]
      }),
    );
  }

  renderTeamBlock(teamData) {
    // 1. Only fallback to {} if data or data.competition is genuinely null/undefined
    const team = teamData ?? {};

    // If we have data, use its real ID. If not, generate a new temporary client ID.
    const key = team.id ?? this.generateId();
    const name = team.name ?? '';
    const players = team.players ?? '';
    const poolPlayers = team.pool_players ?? '';

    const div = document.createElement('div');
    div.dataset.key = key;
    div.className = 'team-entry-card';
    div.style.cssText = html`border: 1px solid var(--border); padding: var(--size-2); border-radius: var(--radius-1);
    background: var(--surface-2);`;

    // Base Rink Name Input
    let teamHtml = html`<div
        style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"
      >
        <label style="font-weight: bold;" class="team-number-label"></label>
        <button
          type="button"
          class="remove-row-btn"
          style="background:none; border:none; color:var(--red-6); cursor:pointer;"
        >
          ✕ Remove
        </button>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <input class="team-name" type="text" name="team[${key}].name" value="${name}" style="width:100%;" required />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;"></div> `;
    let chipHtml = '';

    for (const player of players) {
      chipHtml += html`<span class="player-chip" data-id="${player.id}">
        ${player.name}(${player.role})<button type="button" class="remove-chip-btn">✕</button>
        <!-- Submits state natively -->
        <input type="hidden" name="team[${key}].player[${player.id}].name" value="${player.name}" />
        <input type="hidden" name="team[${key}].player[${player.id}].role" value="${player.role}" />
      </span>`;
    }
    teamHtml += html`
      <div>
        <label style="font-size: var(--font-size-0); color: var(--text-2);"
          >Team players (Add (s) after the skip's name)</label
        >
        <div class="player-chip-field">
          ${chipHtml}

          <!-- The actual text field folk type into -->
          <input type="text" class="chip-text-input" placeholder="Type name and press Enter..." />
        </div>
      </div>
    `;
    chipHtml = '';
    for (const player of poolPlayers) {
      chipHtml += html`<span class="pool-player-chip" data-id="${player.id}">
        ${player.name}<button type="button" class="remove-chip-btn">✕</button>
        <!-- Submits state natively -->
        <input type="hidden" name="team[${key}].player[${player.id}].name" value="${player.name}" />
      </span>`;
    }
    teamHtml += html`
      <div>
        <label style="font-size: var(--font-size-0); color: var(--text-2);"
          >Team players (Add (s) after the skip's name)</label
        >
        <div class="player-chip-field">
          ${chipHtml}

          <!-- The actual text field folk type into -->
          <input type="text" class="chip-pool-input" placeholder="Type name and press Enter..." />
        </div>
      </div>
    `;

    div.innerHTML = teamHtml;
    div.querySelector('.remove-row-btn').addEventListener('click', () => {
      div.remove();
      this.updateVisualTeamLabels();
      this.dispatchTeamsUpdate();
    });

    // Keep your live dropdown text sync listening to the Rink Name box
    div.querySelector('input[type="text"].team-name').addEventListener('input', () => this.dispatchTeamsUpdate());

    const input = div.querySelector('.chip-text-input');

    // Convert text to a permanent data chip on Enter or Comma
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        this.addPlayerChip(input);
      }
    });

    // Also convert when they click out of the box
    input.addEventListener('blur', () => {
      this.addPlayerChip(input);
    });
    const poolinput = div.querySelector('.chip-pool-input');

    // Convert text to a permanent data chip on Enter or Comma
    poolinput.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        this.addPoolPlayerChip(poolinput);
      }
    });

    // Also convert when they click out of the box
    poolinput.addEventListener('blur', () => {
      this.addPoolPlayerChip(poolinput);
    });

    const chips = div.querySelectorAll('.player-chip, .pool-player-chip');
    chips.forEach(chip => chip.addEventListener('click', () => chip.remove()));

    return div;
  }
  addPlayerChip(inputField) {
    const rawValue = inputField.value.trim().replace(/,$/, '');
    if (!rawValue) return;

    const teamKey = inputField.closest('.team-entry-card').dataset.key;
    const tempPlayerId = this.generateId();

    // Parse roles out if they typed something like "Ian(skip)"
    let name = rawValue;
    let role = 'regular';
    const roleMatch = rawValue.match(/(.*)\((skip|third|second|lead|regular)\)/i);
    if (roleMatch) {
      name = roleMatch[1].trim();
      role = roleMatch[2].toLowerCase();
    }

    // Create the visual pill container
    const chip = document.createElement('span');
    chip.className = 'player-chip';
    chip.innerHTML = `
      ${name} ${role !== 'regular' ? `(${role})` : ''}
      <button type="button" class="remove-chip-btn">✕</button>
      <input type="hidden" name="team[${teamKey}].player[${tempPlayerId}].name" value="${name}">
      <input type="hidden" name="team[${teamKey}].player[${tempPlayerId}].role" value="${role}">
    `;

    const removeBtn = chip.querySelector('.remove-chip-btn');

    chip.addEventListener('click', event => {
      chip.remove();
    });

    // Insert the chip visually right before the text box
    inputField.before(chip);
    inputField.value = ''; // Empty the input for the next entry
  }
  addPoolPlayerChip(inputField) {
    const rawValue = inputField.value.trim().replace(/,$/, '');
    if (!rawValue) return;

    const teamKey = inputField.closest('.team-entry-card').dataset.key;
    const tempPlayerId = this.generateId();

    // Parse roles out if they typed something like "Ian(skip)"
    let name = rawValue;

    // Create the visual pill container
    const chip = document.createElement('span');
    chip.className = 'player-chip';
    chip.innerHTML = `
      ${name}
      <button type="button" class="remove-chip-btn">✕</button>
      <input type="hidden" name="team[${teamKey}].poolplayer[${tempPlayerId}].name" value="${name}">
    `;

    const removeBtn = chip.querySelector('.remove-chip-btn');

    chip.addEventListener('click', event => {
      chip.remove();
    });

    // Insert the chip visually right before the text box
    inputField.before(chip);
    inputField.value = ''; // Empty the input for the next entry
  }

  hydrate(data) {
    const { teams } = data;

    this.teamsContainer.innerHTML = '';

    data.teams.forEach(team => {
      // 1. Build the main draw round block container
      const teamBlock = this.renderTeamBlock(team);

      // 3. Mount the fully populated block to the page
      this.teamsContainer.appendChild(teamBlock);
    });

    this.updateVisualTeamLabels(); // Update visual counts instantly

    this.dispatchTeamsUpdate();
  }

  onAddTeam() {
    const freshTeamBlock = this.renderTeamBlock(); // No arguments = defaults to creation
    this.teamsContainer.appendChild(freshTeamBlock);
    this.updateVisualTeamLabels(); // Update visual counts instantly

    this.dispatchTeamsUpdate();
  }

  addTeam() {
    this.currentTeamCount++;

    const key = `new_${this.currentTeamCount}`;

    const div = document.createElement('div');
    div.dataset.key = key;
    div.className = 'team-entry-card';
    div.style.cssText = html`border: 1px solid var(--border); padding: var(--size-2); border-radius: var(--radius-1);
    background: var(--surface-2);`;

    // Base Rink Name Input
    let teamHtml = html`<div
        style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"
      >
        <label style="font-weight: bold;" class="team-number-label"></label>
        <button
          type="button"
          class="remove-row-btn"
          style="background:none; border:none; color:var(--red-6); cursor:pointer;"
        >
          ✕ Remove
        </button>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <input
          class="team-name"
          type="text"
          name="team[${key}].name"
          placeholder="e.g., Team Smith"
          style="width:100%;"
          required
        />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;"></div> `;

    teamHtml += html`
      <div>
        <label style="font-size: var(--font-size-0); color: var(--text-2);"
          >Team players (Add (s) after the skip's name)</label
        >
        <input type="text" name="team[${key}].players" />
      </div>
    `;

    // Pool Players text field
    teamHtml += html`
      <div>
        <label style="font-size: var(--font-size-0); color: var(--text-2);"
          >Pool / Sub Players (Comma separated):</label
        >
        <input
          type="text"
          name="team[${key}].pool"
          placeholder="e.g. Brian McArtney, Jim Menzies"
          style="width:100%;"
        />
      </div>
    `;

    div.innerHTML = teamHtml;
    div.querySelector('.remove-row-btn').addEventListener('click', () => {
      div.remove();
      this.updateVisualTeamLabels();
      this.dispatchTeamsUpdate();
    });

    // Keep your live dropdown text sync listening to the Rink Name box
    div.querySelector('input[type="text"].team-name').addEventListener('input', () => this.dispatchTeamsUpdate());
    this.teamsContainer.appendChild(div);

    this.updateVisualTeamLabels(); // Update visual counts instantly

    this.dispatchTeamsUpdate();
  }
}

customElements.define('syllabus-teams', SyllabusTeams);
