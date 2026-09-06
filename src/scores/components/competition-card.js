import { html } from 'js/html.js';

class CompetitionCard extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', e => {
      // Allow light dismissal clicking on the header to toggle the full details card
      const header = e.target.closest('.card-summary-header');
      if (header) {
        this.toggleCardExpansion();
      }
    });
  }

  hydrate(compData) {
    this.dataset.type = compData.type || 'league'; // Used by filter matching engine
    this.dataset.raw = JSON.stringify(compData); // Quick reference cache for text search filters

    const isSingleDrawFriendly = compData.fixtures && compData.fixtures.length === 1;

    if (isSingleDrawFriendly) {
      this.renderAsCompactFriendly(compData);
    } else {
      this.renderAsStandardLeague(compData);
    }
  }

  // --- OPTIMIZED PATH: One-off Friendly or Single Draw Event ---
  renderAsCompactFriendly(comp) {
    const draw = comp.fixtures[0];
    const gamesCount = draw.games?.length || 0;

    // Map team names instantly for a readable summary string
    const matchStrings = (draw.games || []).map(g => `[${g.team_a_name || 'TBD'} v ${g.team_b_name || 'TBD'}]`);

    this.innerHTML = html`
      <div class="public-card friendly-style">
        <div
          class="card-summary-header"
          style="cursor: pointer; padding: var(--size-3); border: 1px solid var(--border);"
        >
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <h4 style="margin: 0; font-size: var(--font-size-2); color: var(--brand);">${comp.name}</h4>
            <span style="font-size: var(--font-size-0); font-weight: bold; color: var(--text-2);">
              📅 ${draw.date} @ ${draw.time}
            </span>
          </div>
          <div
            class="matches-preview-row"
            style="margin-top: 8px; font-size: var(--font-size-0); color: var(--text-1);"
          >
            <strong>Games (${gamesCount}):</strong> ${matchStrings.join('   ')}
          </div>
        </div>

        <!-- Collapsible Extended Details Drawer -->
        <div
          class="card-expanded-details"
          style="display: none; padding: var(--size-3); border: 1px solid var(--border); border-top: none; background: var(--surface-2);"
        >
          ${this.renderTeamsAndReservesTemplate(comp)}
        </div>
      </div>
    `;
  }

  // --- STANDARD PATH: Leagues, Bonspiels, or Multi-Draw Tournaments ---

  renderAsStandardLeague(comp) {
    const drawsCount = comp.fixtures?.length || 0;

    // 1. DYNAMIC DICTIONARY MAP: Map absolute database IDs to clean sequential layout numbers (Team 1, Team 2...)
    // Since the JSON array order is definitive, this locks them to their actual positions instantly!
    const teamVisualNumberMap = new Map((comp.teams || []).map((team, idx) => [team.id, idx + 1]));

    this.innerHTML = html`
      <div class="public-card league-style">
        <div
          class="card-summary-header"
          style="cursor: pointer; padding: var(--size-3); border: 1px solid var(--border);"
        >
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; font-size: var(--font-size-2);">${comp.name}</h4>
            <span class="count-pill">${drawsCount} Draws Scheduled</span>
          </div>
        </div>

        <div
          class="card-expanded-details"
          style="display: none; padding: var(--size-3); border: 1px solid var(--border); border-top: none; background: var(--surface-2);"
        >
          <!-- Part A: Rosters & Specific Team Pools -->
          ${this.renderTeamsAndReservesTemplate(comp)}

          <!-- Part B: Global Competition Reserves -->
          ${this.renderInlineList(comp.reserves, '🏆 Competition Pool Reserves')}

          <!-- Part C: Draw Timeline Matrix (e.g. Sun. 01st Nov. 11:30   2 v 5  4 v 3  1 v 6) -->
          <h5 style="margin: var(--size-3) 0 var(--size-1) 0; border-bottom: 1px dashed var(--border);">
            Draw Timeline
          </h5>
          <div class="draw-timeline-list" style="display: flex; flex-direction: column; gap: var(--size-2);">
            ${comp.fixtures
              .map((draw, idx) => {
                // 2. MATCH MATRIX TRANSLATION: Cross-reference game IDs with our sequential dictionary
                const matchTokens = (draw.games || [])
                  .map(g => {
                    const teamANum = teamVisualNumberMap.get(g.team_a) || 'TBD';
                    const teamBNum = teamVisualNumberMap.get(g.team_b) || 'TBD';
                    return `${teamANum} v ${teamBNum}`;
                  })
                  .join('    '); // Wide spacing separating matchups inline

                return html`
                  <div
                    class="draw-timeline-row"
                    style="font-size: var(--font-size-1); display: flex; gap: var(--size-4); margin-bottom: var(--size-2); align-items: baseline;"
                  >
                    <!-- Date & Time Track -->
                    <span style="color: var(--text-2); min-width: 180px; font-weight: 500;">
                      ${draw.date} ${draw.time}
                    </span>

                    <!-- Compact Game Codes (e.g., 2 v 5    4 v 3    1 v 6) -->
                    <span style="color: var(--text-1); font-weight: bold; font-family: monospace; letter-spacing: 1px;">
                      ${matchTokens || 'No matchups assigned'}
                    </span>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderInlineList(items, label) {
    if (!items || items.length === 0) return '';

    const namesArray = Array.isArray(items)
      ? items.map(p => p.name)
      : items
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

    if (namesArray.length === 0) return '';

    return html`
      <div
        style="font-size: var(--font-size-1); background: var(--surface-3); padding: var(--size-2); border-radius: 4px; margin-top: var(--size-2); margin-bottom: var(--size-2);"
      >
        <strong>${label}:</strong> ${namesArray.join(', ')}
      </div>
    `;
  }

  renderTeamsAndReservesTemplate(comp) {
    const teamTokens = (comp.teams || [])
      .map((t, idx) => {
        // 1. Map player roster names dynamically, adding bolding if they are the skip
        const mainPlayers = (t.players || []).map(p => {
          const shortDisplayMap = this.roleDisplayMap || { skip: 's', third: '3', second: '2', lead: '1' };
          const abbrev = shortDisplayMap[p.role];
          const isSkip = p.role === 'skip';

          // If they are a skip, wrap their name in strong tags natively
          const displayName = isSkip ? html`<strong>${p.name}</strong>` : p.name;

          return abbrev ? html`${displayName}(${abbrev})` : displayName;
        });

        // 2. Gather local pool substitutes
        const poolPlayers = (t.pool_players || []).map(p => p.name);

        // 3. Combine into one traditional continuous array
        const allRinkNames = [...mainPlayers, ...poolPlayers];

        return html`
          <div
            class="public-team-line"
            style="font-size: var(--font-size-1); margin-bottom: var(--size-2); line-height: 1.4;"
          >
            <strong>Team ${idx + 1}: ${t.name}</strong> -

            <!-- 💡 CLEAN INTERPOLATION JOIN PASS: Loops and appends a comma + space natively between names -->
            ${allRinkNames.map((name, nameIdx) => html` ${name}${nameIdx < allRinkNames.length - 1 ? ', ' : ''} `)}
          </div>
        `;
      })
      .join('');

    return html`
      <h5
        style="margin: 0 0 var(--size-2) 0; font-size: var(--font-size-1); border-bottom: 1px dashed var(--border); padding-bottom: 4px;"
      >
        Rinks & Rosters
      </h5>
      <div class="teams-vertical-stack" style="margin-bottom: var(--size-4);">${teamTokens}</div>
    `;
  }

  toggleCardExpansion() {
    const detailsDrawer = this.querySelector('.card-expanded-details');
    if (detailsDrawer) {
      const isHidden = detailsDrawer.style.display === 'none';
      detailsDrawer.style.display = isHidden ? 'block' : 'none';
      this.querySelector('.public-card').classList.toggle('is-expanded', isHidden);
    }
  }
}
customElements.define('competition-card', CompetitionCard);
