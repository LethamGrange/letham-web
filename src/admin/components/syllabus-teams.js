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

  clear() {
    const tic = this.querySelector('.teams-input-container');
    tic.innerHTML = '';
  }

  renderTeamBlock(teamData) {
    const team = teamData ?? {};
    const key = team.id ?? this.generateId();
    const name = team.name ?? '';

    const div = document.createElement('div');
    div.dataset.key = key;
    div.className = 'team-entry-card';
    div.style.cssText = `border: 1px solid var(--border); padding: var(--size-2); border-radius: var(--radius-1); background: var(--surface-2);`;

    // Start with common Header and Team Name layout inputs
    let teamHtml = html`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
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
    `;

    // Section loop handles layout configuration for regular players vs pool players
    const sections = [
      {
        data: team.players ?? [],
        isPool: false,
        className: 'player-chip',
        inputClass: 'chip-text-input',
        label: "Team players (Add (s) after the skip's name)",
      },
      {
        data: team.pool_players ?? [],
        isPool: true,
        className: 'pool-player-chip',
        inputClass: 'chip-pool-input',
        label: 'Pool players',
      },
    ];

    sections.forEach(sec => {
      let chipHtml = '';
      for (const player of sec.data) {
        const typeKey = sec.isPool ? 'poolplayer' : 'player';
        const roleDisplay = !sec.isPool && player.role && player.role !== 'regular' ? `(${player.role})` : '';
        const roleInput = !sec.isPool
          ? `<input type="hidden" name="team[${key}].player[${player.id}].role" value="${player.role}" />`
          : '';

        chipHtml += html` <span class="${sec.className}" data-id="${player.id}">
          ${player.name}${roleDisplay}<button type="button" class="remove-chip-btn">✕</button>
          <input type="hidden" name="team[${key}].${typeKey}[${player.id}].name" value="${player.name}" />
          ${roleInput}
        </span>`;
      }

      teamHtml += html`
        <div>
          <label style="font-size: var(--font-size-0); color: var(--text-2);">${sec.label}</label>
          <div class="player-chip-field">
            ${chipHtml}
            <input type="text" class="${sec.inputClass}" placeholder="Type name and press Enter..." />
          </div>
        </div>
      `;
    });

    div.innerHTML = teamHtml;

    // Wire up structural layout control buttons
    div.querySelector('.remove-row-btn').addEventListener('click', () => {
      div.remove();
      this.updateVisualTeamLabels();
      this.dispatchTeamsUpdate();
    });

    div.querySelector('input[type="text"].team-name').addEventListener('input', () => this.dispatchTeamsUpdate());

    // Attach dynamic chip listeners uniformly using the configuration details
    sections.forEach(sec => {
      const input = div.querySelector(`.${sec.inputClass}`);

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          this.addChip(input, sec.isPool);
        }
      });

      input.addEventListener('blur', () => this.addChip(input, sec.isPool));
    });

    // Target all existing chips inside the container in one sweeping operation
    div.querySelectorAll('.player-chip, .pool-player-chip').forEach(chip => {
      chip.addEventListener('click', () => chip.remove());
    });

    return div;
  }

  addChip(inputField, isPool = false) {
    const rawValue = inputField.value.trim().replace(/,$/, '');
    if (!rawValue) return;

    const teamKey = inputField.closest('.team-entry-card').dataset.key;
    const tempPlayerId = this.generateId();
    const typeKey = isPool ? 'poolplayer' : 'player';

    let name = rawValue;
    let role = 'regular';

    // Only parse roles out if it is NOT a pool player
    if (!isPool) {
      const roleMatch = rawValue.match(/(.*)\((skip|third|second|lead|regular)\)/i);
      if (roleMatch) {
        name = roleMatch[1].trim();
        role = roleMatch[2].toLowerCase();
      }
    }

    // Create the visual pill container
    const chip = document.createElement('span');
    chip.className = isPool ? 'pool-player-chip' : 'player-chip';

    // Conditionally include role badge layout for normal players
    const roleDisplay = !isPool && role !== 'regular' ? ` (${role})` : '';
    const roleInput = !isPool
      ? `<input type="hidden" name="team[${teamKey}].player[${tempPlayerId}].role" value="${role}">`
      : '';

    chip.innerHTML = `
    ${name}${roleDisplay}
    <button type="button" class="remove-chip-btn">✕</button>
    <input type="hidden" name="team[${teamKey}].${typeKey}[${tempPlayerId}].name" value="${name}">
    ${roleInput}
  `;

    chip.addEventListener('click', () => chip.remove());

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
