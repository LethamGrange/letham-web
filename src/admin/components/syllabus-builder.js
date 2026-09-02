import { SyllabusBase } from 'js/syllabus-base.js';
import { html } from 'js/html.js';

class SyllabusBuilder extends SyllabusBase {
  connectedCallback() {
    const form = this.querySelector('form');

    this.submitBtn = this.querySelector('button[type="submit"]');
    this.cancelBtn = this.querySelector('#cancel-syllabus-edit');
    this.syllabusFixtures = this.querySelector('syllabus-fixtures');
    this.errorBanner = this.querySelector('.form-error-banner');
    this.setupFormListeners(form);

    document.body.addEventListener('edit-competition-request', event => {
      this.onEditCompetition(event.detail.id);
    });

    // document.body.addEventListener("edit-syllabus-request", async (event) =>
    //   this.onEditSyllabus(event, form),
    // );
    //
    // Kick off the URL inspection quietly on page mount
    // this.loadSyllabusDataForEditing(form);

    // this.cancelBtn.addEventListener('click', () => {
    //   // Simply redirect the browser back to the base admin page URL without parameters
    //   window.location.href = window.location.pathname;
    // });
  } // connectedCallback
  setupFormListeners(form) {
    // Listen for the custom event from the teams element
    this.addEventListener('teams-changed', event => {
      const updatedTeams = event.detail.teams;

      this.syllabusFixtures.updateTeams(updatedTeams); // Update the fixtures element directly
      //this.fixturesEl.updateTeams(updatedTeams);
    });

    // Any input event anywhere signals a change
    form.addEventListener('input', () => {
      // ⚡️ PERFORMANCE GUARD: If we already know the form is dirty,
      // stop immediately and skip costly DOM style updates!
      if (this.isFormDirty) return;

      this.isFormDirty = true;
      this.updateActionButtonsVisibility();
    });

    // 3. Simple escape hatch execution
    const cancelButton = form.querySelector('.cancel-edit-btn');
    if (cancelButton) {
      cancelButton.addEventListener('click', e => {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (this.startingModel) {
          // Rollback straight to our starting state data object
          this.hydrateForm(this.startingModel, form);
        }
      });
    } // Handle explicit Switch to Create Click (Wipe and Reset Mode)
  }
  updateActionButtonsVisibility() {
    const cancelButton = this.querySelector('.cancel-edit-btn');
    const createButton = this.querySelector('.switch-to-create-btn');
    const formHeader = this.querySelector('.form-mode-title');

    if (this.startingModel) {
      // 0 = Clean, 1 = Dirty
      const states = this.isFormDirty ? ['block', 'none'] : ['none', 'block'];

      if (cancelButton) cancelButton.style.display = states[0];
      if (createButton) createButton.style.display = states[1];

      if (formHeader) formHeader.textContent = 'Modify Existing Competition';
    }

    // MODE B: Fresh creation canvas
    else {
      if (cancelButton) cancelButton.style.display = 'none';
      if (createButton) createButton.style.display = 'none';
      if (formHeader) formHeader.textContent = 'New Competition';
    }
  }

  async onEditCompetition(competitionId) {
    try {
      // 2. FETCH PURE JSON FROM CLOUDFLARE
      const response = await fetch(`/admin/get-raw-syllabus-json?id=${competitionId}`);
      if (!response.ok) throw new Error('Could not pull competition database records.');

      const data = await response.json();
      console.log(data);

      this.hydrateForm(data);

      // // 4. SWITCH FORMS METHODS IN PLACE FOR HTMX PUT CODES
      // form.setAttribute('hx-put', '/admin/submit-scorecard');
      // form.removeAttribute('hx-post');
      // htmx.process(form); // Rebinds the active lifecycle handlers to PUT

      // Bring workspace focus smoothly into window view
      this.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      if (this.errorBanner) {
        this.errorBanner.innerHTML = html`<div style="color:var(--red-6)">⚠️ ${error.message}</div>`;
      }
    }
  }

  hydrateForm(data) {
    this.startingModel = data;
    this.isFormDirty = false;

    const competitionMeta = this.querySelector('competition-meta');
    if (competitionMeta) {
      competitionMeta.hydrate(data);
    }

    const syllabusTeams = this.querySelector('syllabus-teams');
    if (syllabusTeams) {
      syllabusTeams.hydrate(data);
    }
    const syllabusFixtures = this.querySelector('syllabus-fixtures');
    if (syllabusFixtures) {
      syllabusFixtures.hydrate(data);
    }

    // 3. Sync up the view layout states
    this.updateActionButtonsVisibility();

    // Tell HTMX to re-bind its internal event listeners to the fresh hx-put attribute
    if (window.htmx) htmx.process(this.form);
  }

  onTeamsChange(event) {}
} // end class SyllabusBuilder

customElements.define('syllabus-builder', SyllabusBuilder);
