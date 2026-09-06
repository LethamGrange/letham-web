import { html } from 'js/html.js';

class CompetitionExplorer extends HTMLElement {
  constructor() {
    super();
    this.allCompetitions = []; // The master JSON payload from the server
    this.filteredCompetitions = [];

    // UI State
    this.currentSeason = new Date().getFullYear().toString();
    this.searchQuery = '';
    this.currentPage = 1;
    this.itemsPerPage = 5; // Clean, readable view height limit
  }

  connectedCallback() {
    if (typeof super.connectedCallback === 'function') {
      super.connectedCallback();
    }

    this.competitionZone = this.querySelector('.competitions-list-container');
    this.container = document.querySelector('.competitions-list-container');
    this.searchInput = document.querySelector('.search-input');
    this.typeSelect = document.querySelector('.filter-type-select');
    this.seasonSelect = this.querySelector('.season-select');
    this.pageText = this.querySelector('.page-indicator-text');

    // Centralised Click Delegation for Page Footer Navigation Channels
    this.addEventListener('click', e => {
      if (e.target.closest('.prev-page-btn') && this.currentPage > 1) {
        this.currentPage--;
        this.runGlobalExplorerFilter();
      }
      if (e.target.closest('.next-page-btn') && this.currentPage < this.totalPages) {
        this.currentPage++;
        this.runGlobalExplorerFilter();
      }
    });

    // Reactive input change loops
    this.searchInput.addEventListener('input', () => {
      this.currentPage = 1; // Reset to page 1 during character search typing
      this.runGlobalExplorerFilter();
    });

    this.typeSelect.addEventListener('change', () => {
      this.currentPage = 1;
      this.runGlobalExplorerFilter();
    });

    // Fetch new backend data package dynamically when swapping seasons
    this.seasonSelect.addEventListener('change', () => {
      this.currentPage = 1;
      this.loadCompetitionsForSeason(this.seasonSelect.value);
    });
    // Defensive guard: Prevent redundant fetches if the element
    // is detached and re-attached to the layout tree dynamically
    if (this.allCompetitions.length === 0 && !this.isLoading) {
      this.loadCompetitionsForSeason(this.seasonSelect.value);
    }
  } // connectedCallback

  async loadCompetitionsForSeason(seasonYear) {
    this.container.innerHTML = html`<p style="padding:var(--size-3); color:var(--text-3);">
      Loading competition index records...
    </p>`;

    try {
      const res = await fetch(`/api/competitions/all?season=${seasonYear}`);
      if (!res.ok) throw new Error(`Fetch error: ${res.status}`);

      const competitionsList = await res.json();

      // Store current models array safely on our instance state
      this.allCompetitions = Array.isArray(competitionsList) ? competitionsList : [competitionsList];
      this.renderAllCardsUpfront();
    } catch (err) {
      this.container.innerHTML = html`<p style="color:var(--red-6); padding:var(--size-3);">
        ⚠️ Could not sync competitions index layout: ${err.message}
      </p>`;
    }
  }

  renderAllCardsUpfront() {
    this.container.innerHTML = '';

    if (this.allCompetitions.length === 0) {
      this.container.innerHTML = html`<p style="padding:var(--size-4); color:var(--text-3); text-align:center;">
        No competition syllabuses found for this season.
      </p>`;
      this.updatePaginationControls(0);
      return;
    }

    this.allCompetitions.forEach(comp => {
      const card = document.createElement('competition-card');
      this.container.appendChild(card);
      card.hydrate(comp);
    });

    this.runGlobalExplorerFilter();
  }

  runGlobalExplorerFilter() {
    const query = this.searchInput?.value?.trim().toLowerCase() || '';
    const selectedType = this.typeSelect?.value || 'all';
    const cards = this.container.querySelectorAll('competition-card');

    let matchingCounter = 0;

    cards.forEach(card => {
      const rawText = card.dataset.raw.toLowerCase();
      const cardType = card.dataset.type;

      const matchesSearch = !query || rawText.includes(query);
      const matchesType = selectedType === 'all' || cardType === selectedType;

      if (matchesSearch && matchesType) {
        // Calculate page slot layout numbers
        const calculatedItemPage = Math.floor(matchingCounter / this.itemsPerPage) + 1;

        if (calculatedItemPage === this.currentPage) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }

        matchingCounter++;
      } else {
        card.style.display = 'none';
      }
    });

    this.updatePaginationControls(matchingCounter);
  }

  updatePaginationControls(totalMatchesFound) {
    this.totalPages = Math.max(1, Math.ceil(totalMatchesFound / this.itemsPerPage));

    // Safety fallback range check
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    if (this.pageText) {
      this.pageText.textContent = html`Page ${this.currentPage} of ${this.totalPages} (${totalMatchesFound} matches
      found)`;
    }

    // Toggle raw button state properties to avoid range overflow clicks
    this.querySelector('.prev-page-btn').disabled = this.currentPage === 1;
    this.querySelector('.next-page-btn').disabled = this.currentPage === this.totalPages;
  }
}

customElements.define('competition-explorer', CompetitionExplorer);
