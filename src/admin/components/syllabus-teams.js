import { SyllabusBase } from 'js/syllabus-base.js';
import { html } from 'js/html.js';

class SyllabusTeams extends SyllabusBase {
  get currentTeamCount() {
    if (!this.teamsContainer) return 0;
    return this.teamsContainer.querySelectorAll('.team-entry-card').length;
  }
  connectedCallback() {
    if (typeof super.connectedCallback === 'function') {
      super.connectedCallback();
    }
    const teamsBlock = this.querySelector('.teams-zone');

    this.teamsContainer = this.querySelector('.teams-input-container');
    this.counterBadge = this.querySelector('.team-count-badge');
    this.addEventListener('input', event => {
      const isTeamNameInput = event.target.matches('.team-name');
      if (!isTeamNameInput) return;

      // Whenever they type, force the summary text preview layout string to refresh dynamically
      this.updateVisualTeamLabels();
    });

    // Inside connectedCallback or a dedicated init listener:
    this.addEventListener('click', event => {
      // --- 1. HANDLE ADD TEAM BUTTON ---
      if (event.target.closest('.add-team-btn')) {
        event.stopPropagation();
        this.onAddTeam();
        return;
      }

      // --- 2. HANDLE REMOVE TEAM ROW BUTTON ---
      const removeRowBtn = event.target.closest('.remove-row-btn');
      if (removeRowBtn) {
        event.stopPropagation();
        const teamCard = removeRowBtn.closest('.team-entry-card');
        if (teamCard) {
          teamCard.remove();
          this.updateVisualTeamLabels();
          this.dispatchTeamsUpdate();
          this.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      // --- 3. HANDLE REMOVE CHIP BUTTON (From our previous refactor) ---
      const removeChipBtn = event.target.closest('.remove-chip-btn');
      if (removeChipBtn) {
        event.stopPropagation();
        const chip = removeChipBtn.closest('.player-chip, .pool-player-chip');
        if (chip) {
          chip.remove();
          this.dispatchTeamsUpdate();
          this.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }
    });

    this.addEventListener('keydown', event => {
      const input = event.target;
      const isChipInput = input.classList.contains('chip-text-input') || input.classList.contains('chip-pool-input');
      if (!isChipInput) return;

      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const isPool = input.classList.contains('chip-pool-input');
        this.addChip(input, isPool);
      }
    });

    // --- CENTRAL BLUR DELEGATOR (Using Capture to trap focus loss) ---
    this.addEventListener(
      'blur',
      event => {
        const input = event.target;
        const isChipInput = input.classList.contains('chip-text-input') || input.classList.contains('chip-pool-input');
        if (!isChipInput) return;

        const isPool = input.classList.contains('chip-pool-input');
        this.addChip(input, isPool);
      },
      { capture: true },
    ); // Crucial: Capture must be true because blur doesn't bubble!
  } // connectedCallback

  updateVisualTeamLabels() {
    if (!this.teamsContainer) return;

    const cards = this.teamsContainer.querySelectorAll('.team-entry-card');

    // 1. Line up sequential labels (Team 1, Team 2...)
    cards.forEach((card, index) => {
      const label = card.querySelector('.team-number-label');
      if (label) label.textContent = `Team ${index + 1}`;
    });

    // 2. Sync raw pill count badge
    if (this.counterBadge) {
      this.counterBadge.textContent = cards.length;
    }

    // 3. GENERATE DYNAMIC DASHBOARD PREVIEW STRINGS
    const previewSpan = this.querySelector('.compact-preview');
    if (previewSpan) {
      const teamNames = Array.from(cards).map((card, index) => {
        const nameInput = card.querySelector('.team-name');
        const nameValue = nameInput?.value?.trim();

        // Output format matches index number sequence e.g., "1: Smith"
        return `${index + 1}: ${nameValue || 'Unnamed Rink'}`;
      });

      // Join all team tokens separated with crisp horizontal dashboard spacing
      previewSpan.textContent = teamNames.join('    ') || 'No teams entered yet.';
    }
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
    this.updateVisualTeamLabels(); // Update visual counts instantly
  }

  renderTeamBlock(teamData) {
    const team = teamData ?? {};
    const key = team.id ?? this.generateId();
    const name = team.name ?? '';

    const div = document.createElement('div');
    div.dataset.key = key;
    div.className = 'team-entry-card';

    // Start with common Header and Team Name layout inputs
    let teamHtml = html`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <label style="font-weight: bold;" class="team-number-label"></label>
        <button
          type="button"
          class="remove-row-btn"
          style="background:none; border:none; color:var(--red-6); cursor:pointer;"
        >
          x
        </button>
      </div>
      <div class="form-group">
        <label for="team-name-${key}">Name</label>
        <input
          id="team-name-${key}"
          class="team-name"
          type="text"
          aria-describedby="team-name-error-${key}"
          name="team[${key}].name"
          value="${name}"
          style="width:100%;"
          required
        />

        <span class="error-message" id="team-name-error-${key}" aria-live="polite">Team name is required </span>
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
        <div class="form-group">
          <label for="competition-name">${sec.label}</label>
          <div class="player-chip-field">
            <input type="text" class="${sec.inputClass}" placeholder="Type name and press Enter..." /> ${chipHtml}
          </div>
        </div>
      `;
    });

    div.innerHTML = teamHtml;

    div.querySelector('input[type="text"].team-name').addEventListener('input', () => this.dispatchTeamsUpdate());
    return div;
  }

  addChip(inputField, isPool = false) {
    const rawValue = inputField.value.trim().replace(/,$/, '');
    if (!rawValue) return;

    const teamKey = inputField.closest('.team-entry-card').dataset.key;
    const tempPlayerId = this.generateId();
    const typeKey = isPool ? 'poolplayer' : 'player';
    // Find the wrapper container element holding all the chips and the input field
    const chipFieldContainer = inputField.closest('.player-chip-field');

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

    chipFieldContainer.appendChild(chip);

    inputField.value = ''; // Empty the input
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
    // 1. Locate the container's parent <details> section safely
    const accordionSection = this.teamsContainer.closest('.accordion-teams-section');

    // 2. Ensure it has the "open" attribute so the new row is visible
    if (accordionSection && !accordionSection.hasAttribute('open')) {
      accordionSection.setAttribute('open', '');
    }
    const freshTeamBlock = this.renderTeamBlock(); // No arguments = defaults to creation
    this.teamsContainer.appendChild(freshTeamBlock);
    this.updateVisualTeamLabels(); // Update visual counts instantly

    this.dispatchTeamsUpdate(); // --- SAFE AUTO-FOCUS LOGIC ---
    // Only auto-focus if the device has a fine pointer (like a mouse) to prevent keyboard jumps on mobile/tablets
    const isDesktop = window.matchMedia('(pointer: fine)').matches;

    if (isDesktop) {
      const nameInput = freshTeamBlock.querySelector('.team-name');
      if (nameInput) {
        nameInput.focus();
      }
    }
    this.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

customElements.define('syllabus-teams', SyllabusTeams);
