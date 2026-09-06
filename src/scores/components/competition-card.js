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
    if (!comp.fixtures) comp.fixtures = [];
    const drawsCount = comp.fixtures.length;

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
          ${this.renderTeamsAndReservesTemplate(comp)}

          <h5 style="margin: var(--size-3) 0 var(--size-1) 0; border-bottom: 1px dashed var(--border);">
            Draw Timeline
          </h5>
          <div class="draw-timeline-list" style="display: flex; flex-direction: column; gap: var(--size-2);">
            ${comp.fixtures.map((draw, idx) => {
              const games = (draw.games || [])
                .map(g => {
                  // Check if either team name is still flagged as To Be Decided
                  const teamA = g.team_a_name === 'TBD' ? '<span class="tbd-text">TBD</span>' : g.team_a_name;
                  const teamB = g.team_b_name === 'TBD' ? '<span class="tbd-text">TBD</span>' : g.team_b_name;

                  return `${teamA} v ${teamB}`;
                })
                .join(', ');
              return html`
                <div style="font-size: var(--font-size-1); display: flex; gap: var(--size-3);">
                  <strong style="min-width: 70px; color: var(--color-8);">Draw ${idx + 1}:</strong>
                  <span style="color: var(--text-2); min-width: 140px;">${draw.date} ${draw.time}</span>
                  <span style="color: var(--text-1); font-style: italic;">(${games})</span>
                </div>
              `;
            })}
          </div>
        </div>
      </div>
    `;
  }

  renderTeamsAndReservesTemplate(comp) {
    const teamTokens = (comp.teams || []).map((t, idx) => {
      const players = (t.players || []).map(p => p.name).join(', ');
      return html`<div>
        <strong>${idx + 1}. ${t.name}</strong>
        <span style="color: var(--text-2); font-size: var(--font-size-0);">(${players || 'No roster entry'})</span>
      </div>`;
    });

    const poolTokens = (comp.pool_players || []).map(p => p.name).join(', ');

    return html`
      <h5 style="margin: 0 0 var(--size-1) 0; border-bottom: 1px dashed var(--border);">Registered Rinks & Rosters</h5>
      <div
        style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--size-2); margin-bottom: var(--size-3);"
      >
        ${teamTokens}
      </div>
      ${poolTokens ? html`<div style="font-size: var(--font-size-1); background: var(--surface-3); padding: var(--size-2); border-radius: 4px;"><strong>Available Pool Reserves:</strong> ${poolTokens}</div>` : ''}
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
