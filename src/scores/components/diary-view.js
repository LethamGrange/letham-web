import { html } from 'js/html.js';

class DiaryView extends HTMLElement {
  constructor() {
    super();
    this.allCompetitions = [];
    this.isLoading = false;
  }

  connectedCallback() {
    this.container = this.querySelector('.diary-table-layout');

    // Select the filter bar element from the document tree
    this.typeSelect = document.querySelector('.filter-type-select');

    // Add event listener to trigger updates instantly on menu changes
    if (this.typeSelect) {
      this.typeSelect.addEventListener('change', () => this.runGlobalExplorerFilter());
    }

    if (this.allCompetitions.length === 0 && !this.isLoading) {
      this.loadCompetitionsForSeason();
    }
  }

  async loadCompetitionsForSeason() {
    this.isLoading = true;
    this.container.innerHTML = html`
      <p style="padding:var(--size-3); color:var(--text-muted);">Loading competition records...</p>
    `;

    try {
      const res = await fetch(`/api/diary`);
      if (!res.ok) throw new Error(`Fetch error: ${res.status}`);

      const { diary } = await res.json();

      // Store the master payload unchanged
      this.allCompetitions = Array.isArray(diary) ? diary : [diary];
      this.runGlobalExplorerFilter();
    } catch (err) {
      this.container.innerHTML = html`
        <p style="color:var(--critical); padding:var(--size-3);">
          ⚠️ Could not sync competitions index layout: ${err.message}
        </p`;
    } finally {
      this.isLoading = false;
    }
  }

  renderAllCardsUpfront(entries) {
    this.container.innerHTML = '';

    if (entries.length === 0) {
      this.container.innerHTML = html`
        <p style="padding:var(--size-4); color:var(--text-muted); grid-column: 1 / -1; text-align:center;">
          No upcoming competition syllabuses found for the selected period.
        </p>
      `;
      return;
    }

    let diaryHtml = html`
      <div class="diary-th">Date</div>
      <div class="diary-th">Time</div>
      <div class="diary-th">Competition / Game</div>
    `;

    entries.forEach(comp => {
      diaryHtml += html`
        <div class="diary-td date-column"><p>${comp.date}</p></div>
        <div class="diary-td time-column"><p>${comp.time}</p></div>
        <div class="diary-td game-column kind-${comp.kind}"><p>${comp.game}</p></div>
      `;
    });

    this.container.innerHTML = diaryHtml;
  }

  runGlobalExplorerFilter() {
    const selectedType = this.typeSelect?.value || 'all';

    // Normalize current clock parameters to Midnight for strict date matching
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nowTimestamp = today.getTime();

    // Standard baseline curling season cap limit (End of April 2027)
    const endSeasonTimestamp = Date.parse('2027-05-01');

    // Dynamic calculations for targeted week boundaries
    let maxAllowedTimestamp = endSeasonTimestamp;

    if (selectedType === '7days') {
      // "This Week": Calculate the timestamp for this upcoming Sunday night
      // If today is Thursday (4), Sunday is in 3 days.
      const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysUntilSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;

      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + daysUntilSunday);
      endOfWeek.setHours(23, 59, 59, 999);
      maxAllowedTimestamp = endOfWeek.getTime();
    } else if (selectedType === '14days') {
      // "Two Weeks": Calculate the timestamp for next week's Sunday night
      const currentDayOfWeek = today.getDay();
      const daysUntilNextSunday = (currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek) + 7;

      const endOfNextWeek = new Date(today);
      endOfNextWeek.setDate(today.getDate() + daysUntilNextSunday);
      endOfNextWeek.setHours(23, 59, 59, 999);
      maxAllowedTimestamp = endOfNextWeek.getTime();
    }

    // Process items matching your raw database timestamp formats
    const filteredEntries = this.allCompetitions.filter(entry => {
      // Fall back to raw ISO parsing if rawDate exists
      const entryTimestamp = Date.parse(entry.rawDate || entry.date);

      if (isNaN(entryTimestamp)) return false;

      // Ensure the fixture is upcoming and falls within the active selection block
      return entryTimestamp >= nowTimestamp && entryTimestamp <= maxAllowedTimestamp;
    });

    this.renderAllCardsUpfront(filteredEntries);
  }
}

customElements.define('diary-view', DiaryView);
