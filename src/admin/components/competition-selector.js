class CompetitionSelector extends HTMLElement {
  constructor() {
    super();
    this.allCompetitions = []; // The master JSON payload from the server
    this.filteredCompetitions = [];

    // UI State
    this.currentSeason = '2026';
    this.searchQuery = '';
    this.currentPage = 1;
    this.pageSize = 10;
  }

  connectedCallback() {
    this.competitionZone = this.querySelector('.competition-zone');
    // Defensive guard: Prevent redundant fetches if the element
    // is detached and re-attached to the layout tree dynamically
    if (this.allCompetitions.length === 0 && !this.isLoading) {
      this.loadCompetitions();
    }
    this.setupFormListeners();
  }

  setupFormListeners() {
    document.addEventListener('competition-saved', e => {
      const savedComp = e.detail.competition;

      // 1. Find if this item already exists in the selector's in-memory array
      const index = this.allCompetitions.findIndex(c => c.id === savedComp.id);

      if (index !== -1) {
        // Update existing item
        this.allCompetitions[index] = savedComp;
      } else {
        // Append it if it was a brand new creation
        this.allCompetitions.push(savedComp);
      }

      // 2. Instantly update the visual list without a single server round-trip!
      this.applyFiltersAndRender();
    });
    document.addEventListener('competition-deleted', e => {
      const targetId = e.detail.id;

      // 1. Filter out the deleted record from your local model memory instantly
      this.allCompetitions = this.allCompetitions.filter(c => c.id !== targetId);

      // 2. Refresh the display grid smoothly without a server round-trip
      this.applyFiltersAndRender();
    });
  }

  async loadCompetitions() {
    this.isLoading = true;
    const apiSrc = '/api/competitions';

    try {
      const response = await fetch(apiSrc);
      if (!response.ok) throw new Error(`Status: ${response.status}`);

      const data = await response.json();
      this.init(data);
    } catch (error) {
      console.error('Failed to load competitions selector model:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Called initially to pass the data payload in
  init(competitions) {
    this.allCompetitions = Array.isArray(competitions) ? competitions : [competitions];
    this.applyFiltersAndRender();
  }

  renderInitialLayout() {
    // Only build the structural wrappers once
    (this.competitionZone ?? this).innerHTML = `
    <div class="selector-controls" style="display: flex; gap: var(--size-3); margin-bottom: var(--size-3);">
      <input type="text" class="search-box" placeholder="Filter competitions..." value="${this.searchQuery}">
      <select class="season-select">
        <option value="2026" ${this.currentSeason === '2026' ? 'selected' : ''}>2026</option>
        <option value="2025" ${this.currentSeason === '2025' ? 'selected' : ''}>2025</option>
      </select>
    </div>

    <!-- Targeted injection wrappers -->
    <div class="competition-list-group"></div>
    <div class="pagination-controls" style="margin-top: var(--size-3); display: flex; gap: var(--size-2); align-items: center;"></div>
  `;

    // Attach static control listeners immediately
    this.setupStaticListeners();
  }

  applyFiltersAndRender() {
    // 1. If the base structural wrappers don't exist yet, build them
    if (!this.querySelector('.search-box')) {
      this.renderInitialLayout();
    }

    // 2. Filter logic

    this.filteredCompetitions = this.allCompetitions.filter(comp => {
      const matchesSeason = comp.season_year === this.currentSeason;

      // 1. Split the query by spaces and clean up empty elements
      const tokens = this.searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

      // 2. Multi-word match: EVERY typed word must find a match somewhere in the row
      const matchesSearch = tokens.every(token => {
        const matchesName = comp.name.toLowerCase().includes(token);
        const matchesKind = comp.kind.toLowerCase().includes(token);
        return matchesName || matchesKind;
      });

      return matchesSeason && matchesSearch;
    });
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const paginatedItems = this.filteredCompetitions.slice(startIndex, startIndex + this.pageSize);
    const totalPages = Math.ceil(this.filteredCompetitions.length / this.pageSize) || 1;

    // 3. Update ONLY the dynamic list inner fragment
    this.querySelector('.competition-list-group').innerHTML = paginatedItems
      .map(
        comp => `
    <div class="comp-select-row" style="display:flex; justify-content:space-between; padding: var(--size-2); border-bottom: 1px solid var(--border);">
      <span>${comp.name} (${comp.kind})</span>
      <button type="button" class="select-comp-btn" data-id="${comp.id}">Select</button>
    </div>
  `,
      )
      .join('');

    // 4. Update ONLY the dynamic paging block fragments
    this.querySelector('.pagination-controls').innerHTML = `
    <button type="button" class="prev-page-btn" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>
    <span>Page ${this.currentPage} of ${totalPages}</span>
    <button type="button" class="next-page-btn" ${this.currentPage === totalPages ? 'disabled' : ''}>Next</button>
  `;

    // 5. Re-bind list actions since their DOM row elements are new
    this.setupDynamicListeners();
  }

  setupStaticListeners() {
    const searchInput = this.querySelector('.search-box');
    searchInput.addEventListener('input', e => {
      this.searchQuery = e.target.value;
      this.currentPage = 1;
      this.applyFiltersAndRender();
    });

    this.querySelector('.season-select').addEventListener('change', e => {
      this.currentSeason = e.target.value;
      this.currentPage = 1;
      this.applyFiltersAndRender();
    });
  }

  setupDynamicListeners() {
    // Bind list row actions
    this.querySelectorAll('.select-comp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('edit-competition-request', {
            bubbles: true,
            detail: { id: btn.dataset.id },
          }),
        );
      });
    });

    // Bind pagination actions
    this.querySelector('.prev-page-btn').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.applyFiltersAndRender();
      }
    });

    this.querySelector('.next-page-btn').addEventListener('click', () => {
      const totalPages = Math.ceil(this.filteredCompetitions.length / this.pageSize);
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.applyFiltersAndRender();
      }
    });
  }
}

customElements.define('competition-selector', CompetitionSelector);
