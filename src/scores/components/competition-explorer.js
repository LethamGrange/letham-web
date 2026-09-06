import { html } from 'js/html.js';

class CompetitionExplorer extends HTMLElement {
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
    if (typeof super.connectedCallback === 'function') {
      super.connectedCallback();
    }

    this.competitionZone = this.querySelector('.competitions-list-container');
    this.container = document.querySelector('.competitions-list-container');
    this.searchInput = document.querySelector('.search-input');
    this.typeSelect = document.querySelector('.filter-type-select');
    // Defensive guard: Prevent redundant fetches if the element
    // is detached and re-attached to the layout tree dynamically
    if (this.allCompetitions.length === 0 && !this.isLoading) {
      this.loadCompetitions();
    }
  } // connectedCallback

  async loadCompetitions() {
    this.isLoading = true;
    const apiSrc = '/api/competitions/all';

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

  applyFiltersAndRender() {
    const container = this.container;
    if (!container) return;

    // 1. Clear previous session nodes
    container.innerHTML = '';

    // 2. Loop through your loaded database model array
    this.allCompetitions.forEach(compData => {
      // Instantiate your public custom element card natively
      const card = document.createElement('competition-card');

      // Mount to the container first so it establishes lifecycle bounds
      container.appendChild(card);

      // Inject the specific layout data payload instantly!
      card.hydrate(compData);
    });

    // 3. Run the filter rules immediately to catch default configurations
    this.runGlobalExplorerFilter();
  }

  init(competitions) {
    this.allCompetitions = Array.isArray(competitions) ? competitions : [competitions];
    this.applyFiltersAndRender();
  }

  runGlobalExplorerFilter() {
    const query = this.searchInput.value.trim().toLowerCase();
    const selectedType = this.typeSelect.value;
    const cards = this.container.querySelectorAll('public-competition-card');

    cards.forEach(card => {
      const rawSearchText = card.dataset.raw.toLowerCase();
      const cardType = card.dataset.type;

      // Symmetrical evaluation check
      const matchesSearch = !query || rawSearchText.includes(query);
      const matchesType = selectedType === 'all' || cardType === selectedType;

      if (matchesSearch && matchesType) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  }
}

customElements.define('competition-explorer', CompetitionExplorer);
