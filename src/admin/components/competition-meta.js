import { SyllabusBase } from 'js/syllabus-base.js';

class CompetitionMeta extends SyllabusBase {
  connectedCallback() {
    const metaBlock = this.querySelector('.competition-zone');
  }
}

customElements.define('competition-meta', CompetitionMeta);
