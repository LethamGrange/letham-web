import { SyllabusBase } from 'js/syllabus-base.js';

class CompetitionMeta extends SyllabusBase {
  connectedCallback() {
    this.metaBlock = this.querySelector('.competition-zone');
  }

  hydrate(data) {
    // 1. Only fallback to {} if data or data.competition is genuinely null/undefined
    const competition = data?.competition ?? {};

    // 2. Handle the hidden ID element
    const idEl = this.querySelector('input[type="hidden"]');
    idEl.value = competition.id ?? this.generateId();

    // 3. Loop through the standard inputs
    ['name', 'kind', 'reserves'].forEach(field => {
      const el = this.querySelector(`[name="competition[${field}]"]`);
      if (!el) return; // Defensive check in case the HTML changes

      if (field === 'kind') {
        // If competition.kind is null/undefined, default to 'local'
        el.value = competition.kind ?? 'league';

        // Warning for stale database values
        if (el.value === '' && competition.kind) {
          console.warn(`Old database value "${competition.kind}" is no longer valid for kind.`);
        }
      } else {
        // Using ?? ensures that 0 or false isn't wiped out into an empty string
        el.value = competition[field] ?? '';
      }
    });
  }
}

customElements.define('competition-meta', CompetitionMeta);
