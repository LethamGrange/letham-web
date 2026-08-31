import { SyllabusBase } from 'js/syllabus-base.js';
import { html } from 'js/html.js';

class SyllabusTeams extends SyllabusBase {
  currentTeamCount = 0;

  connectedCallback() {
    const teamsBlock = this.querySelector('.teams-zone');

    this.teamsContainer = this.querySelector('.teams-input-container');

    const addTeamBtn = this.querySelector('.add-team-btn');
    addTeamBtn.addEventListener('click', () => this.addTeam());
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
