import { SyllabusBase } from 'js/syllabus-base.js';
import { html } from 'js/html.js';

class SyllabusTeams extends SyllabusBase {
  get currentTeamCount() {
    if (!this.teamsContainer) return 0;
    return this.teamsContainer.querySelectorAll('.team-entry-card').length;
  }

  get roleDisplayMap() {
    return {
      skip: 's',
      third: '3',
      second: '2',
      lead: '1',
    };
  }
  connectedCallback() {
    if (typeof super.connectedCallback === 'function') {
      super.connectedCallback();
    }
    const teamsBlock = this.querySelector('.teams-zone');

    this.teamsContainer = this.querySelector('.teams-input-container');
    this.counterBadge = this.querySelector('.team-count-badge');

    this.addEventListener('input', event => {
      // A: Handle Team Name updates live
      if (event.target.matches('.team-name')) {
        this.dispatchTeamsUpdate();
        return;
      }

      // B: Handle your summary preview title rendering updates (from your prior step!)
      if (event.target.matches('.team-name')) {
        this.updateVisualTeamLabels();
        return;
      }
    });

    // Inside connectedCallback or a dedicated init listener:
    this.addEventListener('click', event => {
      // --- 1. HANDLE ADD TEAM BUTTON ---
      if (event.target.closest('.add-team-btn')) {
        event.stopPropagation();
        this.onAddTeam();
        return;
      }

      this.handlePlayerTextClick(event);

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

    this.addEventListener('keydown', event => this.handlePlayerKeyOrBlur(event));

    // --- CENTRAL BLUR DELEGATOR ---
    this.addEventListener(
      'blur',
      event => this.handlePlayerKeyOrBlur(event),
      { capture: true }, // Keep capture true!
    );
  } // connectedCallback

  handlePlayerKeyOrBlur(event) {
    const input = event.target;
    const isTextField = input.classList.contains('chip-text-input') || input.classList.contains('chip-pool-input');
    if (!isTextField) return;

    const isBlur = event.type === 'blur';
    const isEnter = event.type === 'keydown' && event.key === 'Enter';

    // Explicit condition: Process if the user clicks away OR presses Enter
    if (isBlur || isEnter) {
      if (isEnter) {
        event.preventDefault(); // Stop Enter from trying to natively submit the form
      }

      const cardContext = input.closest('.team-entry-card');
      const isPool = input.classList.contains('chip-pool-input');
      const inputClass = isPool ? 'chip-pool-input' : 'chip-text-input';

      this.addPlayerToken(cardContext, inputClass, isPool);

      // Force your master summary title previews to update instantly
      this.updateVisualTeamLabels();
    }
  }
  handlePlayerTextClick(event) {
    const playerToken = event.target.closest('.player-text-token');
    if (playerToken) {
      event.stopPropagation();

      const popover = this.querySelector('#player-action-popover');
      const isPool = playerToken.dataset.isPool === 'true';
      const pName = playerToken.querySelector('.player-display-name').textContent;
      const pId = playerToken.dataset.playerId;

      // 1. SAFELY GRAB THE TEAM KEY RELATIVELY
      const teamCard = playerToken.closest('.team-entry-card');
      const teamKey = teamCard ? teamCard.dataset.key : '';

      // 2. Cache the contextual keys onto the popover's dataset properties
      popover.dataset.teamKey = teamKey;
      popover.dataset.playerId = pId;

      // Anchor the popover visually to the word text natively
      playerToken.style.setProperty('anchor-name', '--active-player-token');
      popover.style.positionAnchor = '--active-player-token';

      // Generate contextual options
      let menuHtml = html`<div
        style="font-weight:bold; font-size:var(--font-size-0); padding: 4px 8px; color:var(--text-2);"
      >
        ${pName}
      </div>`;

      if (!isPool) {
        menuHtml += html`
          <button type="button" class="menu-action-btn" data-action="set-role" data-role="skip">
            👑 Make Skip (s)
          </button>
          <button type="button" class="menu-action-btn" data-action="set-role" data-role="third">
            🥌 Make Third (3)
          </button>
          <button type="button" class="menu-action-btn" data-action="set-role" data-role="second">
            🥌 Make Second (2)
          </button>
          <button type="button" class="menu-action-btn" data-action="set-role" data-role="lead">
            🥌 Make Lead (1)
          </button>
          <button type="button" class="menu-action-btn" data-action="set-role" data-role="regular">
            🧼 Clear Role
          </button>
        `;
      }

      menuHtml += html`<button type="button" class="menu-action-btn remove-player-confirmed">🗑️ Remove Player</button>`;

      popover.innerHTML = menuHtml;
      popover.showPopover();

      // 3. Capture Action Menu Choices
      popover.onclick = menuEvent => {
        const actionBtn = menuEvent.target.closest('.menu-action-btn, .remove-player-confirmed');
        if (!actionBtn) return;

        // Read the cached layout context keys straight off the popover node!
        const activeTeamKey = popover.dataset.teamKey;
        const activePlayerId = popover.dataset.playerId;
        const typeKey = isPool ? 'poolplayer' : 'player';

        if (actionBtn.classList.contains('remove-player-confirmed')) {
          playerToken.remove();
        } else if (actionBtn.dataset.action === 'set-role') {
          const nextRole = actionBtn.dataset.role;
          playerToken.dataset.role = nextRole;

          // Re-map the clean short codes
          const displayAbbreviation = this.roleDisplayMap[nextRole];
          const roleDisplay = !isPool && displayAbbreviation ? ` (${displayAbbreviation})` : '';

          // The screen sees "John (s)" but the hidden form inputs pass pristine array mappings to the server
          const roleInput = !isPool
            ? `<input type="hidden" name="team[${activeTeamKey}].player[${activePlayerId}].role" value="${nextRole}">`
            : '';

          playerToken.innerHTML = `
        <span class="player-display-name">${pName}</span>${roleDisplay}
        <input type="hidden" name="team[${activeTeamKey}].${typeKey}[${activePlayerId}].name" value="${pName}">
        ${roleInput}
      `;
        }

        this.updateVisualTeamLabels();
        this.dispatchTeamsUpdate();
        this.dispatchEvent(new Event('input', { bubbles: true }));
        popover.hidePopover();
      };

      return;
    }
  }
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

    // Define layout structures cleanly—no inner loops!
    div.innerHTML = html`
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
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <!-- Hoisted listener: no inline attachment here -->
        <input class="team-name" type="text" name="team[${key}].name" value="${name}" style="width:100%;" required />
      </div>

      <div class="form-group">
        <label>Team players (Add (s) after the skip's name)</label>
        <div class="player-chip-field">
          <input type="text" class="chip-text-input" placeholder="Type name and press Enter..." />
          <!-- Container line for text tokens -->
          <div class="team-players-line player-text-line"></div>
        </div>
      </div>

      <div class="form-group">
        <label>Pool players</label>
        <div class="player-chip-field">
          <input type="text" class="chip-pool-input" placeholder="Type name and press Enter..." />
          <!-- Container line for pool tokens -->
          <div class="pool-players-line player-text-line"></div>
        </div>
      </div>
    `;

    // 2. HYDRATION PASS: Instantly loop data and feed it right through your single rendering method
    const regularPlayers = team.players ?? [];
    regularPlayers.forEach(p => this.addPlayerToken(div, 'chip-text-input', false, p));

    const poolPlayers = team.pool_players ?? [];
    poolPlayers.forEach(p => this.addPlayerToken(div, 'chip-pool-input', true, p));

    return div;
  }

  normalizeRole(shorthand) {
    if (!shorthand) return 'regular';
    const clean = shorthand.trim().toLowerCase();

    if (clean === '4') return 'skip';
    if (clean === '3') return 'third';
    if (clean === '2') return 'second';
    if (clean === '1') return 'lead';

    if (clean.startsWith('s')) return 'skip';
    if (clean.startsWith('t') || clean.startsWith('v')) return 'third'; // Catches vice/vice-skip
    if (clean.startsWith('se')) return 'second';
    if (clean.startsWith('l') || clean.startsWith('f')) return 'lead'; // Catches lead/first

    return 'regular';
  }

  addPlayerToken(cardContext, inputClass, isPool = false, playerData = null) {
    const inputField = cardContext.querySelector(`.${inputClass}`);
    const teamKey = cardContext.dataset.key;
    const typeKey = isPool ? 'poolplayer' : 'player';
    const targetLine = cardContext.querySelector(isPool ? '.pool-players-line' : '.team-players-line');

    // --- FLOW A: INITIAL HYDRATION (Reading from passed database object) ---
    if (playerData) {
      this.createPlayerElement(targetLine, teamKey, typeKey, isPool, {
        id: playerData.id ?? this.generateId(),
        name: playerData.name ?? '',
        role: playerData.role ?? 'regular',
      });
      return;
    }

    // --- FLOW B: LIVE USER ENTER FLOW (Handles single items OR bulk comma-split entry) ---
    const rawInput = inputField?.value?.trim() ?? '';
    if (!rawInput) return;

    // Split by commas, filter out any accidental empty slots
    const playerStrings = rawInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    playerStrings.forEach(playerStr => {
      let name = playerStr;
      let role = 'regular';
      const tempPlayerId = this.generateId();

      if (!isPool) {
        // Regex captures the name in group [1] and whatever text is inside the brackets in group [2]
        const genericBracketMatch = playerStr.match(/(.*)\((.*)\)/i);
        if (genericBracketMatch) {
          name = genericBracketMatch[1].trim();
          role = this.normalizeRole(genericBracketMatch[2]);
        }
      }

      this.createPlayerElement(targetLine, teamKey, typeKey, isPool, {
        id: tempPlayerId,
        name: name,
        role: role,
      });
    });

    // Clear input field cleanly after all tokens are printed
    if (inputField) inputField.value = '';
  }

  createPlayerElement(targetLine, teamKey, typeKey, isPool, player) {
    const token = document.createElement('button');
    token.type = 'button';
    token.className = 'player-text-token';
    token.dataset.playerId = player.id;
    token.dataset.role = player.role;
    token.dataset.isPool = isPool; // 1. Map database terms to the requested ultra-clear short labels
    const shortDisplayMap = {
      skip: 's',
      third: '3',
      second: '2',
      lead: '1',
    };

    const displayAbbreviation = this.roleDisplayMap[player.role];
    const roleDisplay = !isPool && displayAbbreviation ? ` (${displayAbbreviation})` : '';

    // 2. The screen sees "John (s)" but the hidden form input passes "skip" safely to the server!
    const roleInput = !isPool
      ? html`<input type="hidden" name="team[${teamKey}].player[${player.id}].role" value="${player.role}" />`
      : '';

    token.innerHTML = html`
      <span class="player-display-name">${player.name}</span>${roleDisplay}
      <input type="hidden" name="team[${teamKey}].${typeKey}[${player.id}].name" value="${player.name}" />
      ${roleInput}
    `;

    if (targetLine) targetLine.appendChild(token);
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
