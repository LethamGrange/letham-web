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

    // Connect the client-side download handler
    this.downloadBtn = document.querySelector('.btn-pdf-download');
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => this.executeNativePdfPrintJob());
    }

    // Add event listener to trigger updates instantly on menu changes
    if (this.typeSelect) {
      this.typeSelect.addEventListener('change', () => this.runGlobalExplorerFilter());
    }

    if (this.allCompetitions.length === 0 && !this.isLoading) {
      this.loadCompetitionsForSeason();
    }
  }

  // Add the dedicated print handler method below inside your class definition
  executeNativePdfPrintJob() {
    // Triggers the device's built-in print interface. On mobile devices (iOS/Android),
    // this automatically opens an instant "Save as PDF / Share to WhatsApp" panel.
    window.print();
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

  getNormalizedDesignToken(gameName, compKind) {
    if (!gameName) return 'default';

    // 1. Strip all non-alphanumeric text characters to create a fuzzy match token
    const cleanTitle = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 2. High-Priority: Scan for specific titles that must use the lavender layout
    const ladiesTitles = [
      'janiesmith',
      'hendersonbishop',
      'ladiesopening',
      'ladieschristmas',
      'ladiesclosing',
      'ladiesinterclub',
      'ladiesfriendship',
    ];

    // If the clean title contains any of our known ladies tournament signatures, return early
    for (const titleSignature of ladiesTitles) {
      if (cleanTitle.includes(titleSignature)) {
        return 'ladies-games';
      }
    }

    // 3. Standard Table-driven mapping matrix for standard club games
    const tokenMap = [
      { key: 'bankofscotland', token: 'bank-of-scotland' },
      { key: 'contractor', token: 'contractors-cup' },
      { key: 'superleague', token: 'super-league' },
      { key: 'province', token: 'province-and-area-12-competitions' },
      { key: 'area12', token: 'province-and-area-12-competitions' },
      { key: 'over50', token: 'over-50-s' },
      { key: 'interclub', token: 'inter-club-games' },
      { key: 'fccc', token: 'fccc-competitions' },
      { key: 'agricar', token: 'agricar' },
      { key: 'springleague', token: 'lgcc-competitions-spring-league' },
      { key: 'lgcc', token: 'lgcc-competitions-spring-league' },
      { key: 'lady', token: 'ladies-games' },
      { key: 'ladies', token: 'ladies-games' },
    ];

    // Look for a standard fuzzy keyword match inside the remaining titles
    for (const matchRow of tokenMap) {
      if (cleanTitle.includes(matchRow.key)) {
        return matchRow.token;
      }
    }

    // 4. FALLBACK LAYER: Inspect the raw database 'kind' string
    if (compKind) {
      const cleanKind = compKind.toLowerCase().trim();
      if (cleanKind.includes('league')) return 'generic-league';
      if (cleanKind.includes('bonspiel')) return 'generic-bonspiel';
    }

    return 'default';
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
      // Pass the raw parameters directly into our table-driven matching dictionary
      const cssToken = this.getNormalizedDesignToken(comp.game, comp.kind);

      diaryHtml += html`
        <div class="diary-td date-column" data-kind="${cssToken}"><p>${comp.date}</p></div>
        <div class="diary-td time-column" data-kind="${cssToken}"><p>${comp.time}</p></div>
        <div class="diary-td game-column" data-kind="${cssToken}"><p>${comp.game}</p></div>
      `;
    });
    this.container.innerHTML = diaryHtml;
  }
  runGlobalExplorerFilter() {
    const selectedType = this.typeSelect?.value || 'all';

    // 1. Establish strict midnight anchors for calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nowTimestamp = today.getTime();

    // 2. Determine the boundaries of the FULL current curling season.
    // If we are currently in Oct 2026, the season started around Aug/Sep 2026 and ends May 2027.
    const currentYear = today.getFullYear();
    const isEarlySeason = today.getMonth() >= 7; // August (7) through December (11)

    const seasonStartYear = isEarlySeason ? currentYear : currentYear - 1;
    const seasonEndYear = seasonStartYear + 1;

    // Timestamps for the absolute start and end boundaries of this whole season
    const absoluteSeasonStart = Date.parse(`${seasonStartYear}-08-01`);
    const absoluteSeasonEnd = Date.parse(`${seasonEndYear}-05-01`);

    // 3. Set standard defaults for the "All" view option
    let minAllowedTimestamp = absoluteSeasonStart;
    let maxAllowedTimestamp = absoluteSeasonEnd;

    // 4. Tighten parameters ONLY if searching for upcoming weeks
    if (selectedType === '7days') {
      // "This Week": From today at midnight until this upcoming Sunday night
      minAllowedTimestamp = nowTimestamp;

      const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday...
      const daysUntilSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;

      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + daysUntilSunday);
      endOfWeek.setHours(23, 59, 59, 999);
      maxAllowedTimestamp = endOfWeek.getTime();
    } else if (selectedType === '14days') {
      // "Two Weeks": From today at midnight until next week's Sunday night
      minAllowedTimestamp = nowTimestamp;

      const currentDayOfWeek = today.getDay();
      const daysUntilNextSunday = (currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek) + 7;

      const endOfNextWeek = new Date(today);
      endOfNextWeek.setDate(today.getDate() + daysUntilNextSunday);
      endOfNextWeek.setHours(23, 59, 59, 999);
      maxAllowedTimestamp = endOfNextWeek.getTime();
    }

    // 5. Run the data filter stream safely
    const filteredEntries = this.allCompetitions.filter(entry => {
      const entryTimestamp = Date.parse(entry.rawDate || entry.date);

      if (isNaN(entryTimestamp)) return false;

      // Check if the record fits cleanly within the calculated target window
      return entryTimestamp >= minAllowedTimestamp && entryTimestamp <= maxAllowedTimestamp;
    });

    this.renderAllCardsUpfront(filteredEntries);
  }
}

customElements.define('diary-view', DiaryView);
