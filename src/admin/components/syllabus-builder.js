import { SyllabusBase } from 'js/syllabus-base.js';
import { html } from 'js/html.js';

class SyllabusBuilder extends SyllabusBase {
  constructor() {
    super();

    this.isFormDirty = false;
  }

  connectedCallback() {
    if (typeof super.connectedCallback === 'function') {
      super.connectedCallback();
    }
    const form = this.querySelector('form');

    this.submitBtn = this.querySelector('button[type="submit"]');
    this.cancelBtn = this.querySelector('#cancel-syllabus-edit');
    this.syllabusFixtures = this.querySelector('syllabus-fixtures');
    this.errorBanner = this.querySelector('.form-error-banner');
    this.setupFormListeners(form);

    document.body.addEventListener('edit-competition-request', event => {
      this.onEditCompetition(event.detail.id);
    });
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

    this.setupSubmitListener();

    // 3. Simple escape hatch execution
    const cancelButton = form.querySelector('.cancel-edit-btn');
    if (cancelButton) {
      cancelButton.addEventListener('click', e => {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (this.startingModel) {
          // Rollback straight to our starting state data object
          this.hydrateForm(this.startingModel, form);
        } else {
          this.clearForm();
          this.isFormDirty = false;
          this.updateActionButtonsVisibility();
        }
      });
    } // Handle explicit Switch to Create Click (Wipe and Reset Mode)

    const createButton = this.querySelector('.switch-to-create-btn');

    if (createButton) {
      createButton.addEventListener('click', e => {
        if (this.isFormDirty) return;

        this.clearForm();
      });
    }

    //const deleteButton = form.querySelector('.delete-competition-btn');
    const modal = document.getElementById('delete-confirm-modal');

    if (modal) {
      modal.addEventListener('close', async event => {
        // If they clicked the red "Yes, Delete" button:
        if (modal.returnValue === 'confirm') {
          const compId = form.querySelector('input[type="hidden"]')?.value;
          if (!compId) return;

          // 1. Fire the secure admin DELETE route mutation
          const response = await fetch(`/admin/competitions/${compId}`, { method: 'DELETE' });
          if (!response.ok) throw new Error(`Delete failed: ${response.status}`);

          // 2. Clear the workspace completely using your clean delegated method
          this.clearForm();

          // 3. Broadcast the removal to force the sidebar list to update locally
          this.dispatchEvent(
            new CustomEvent('competition-deleted', {
              bubbles: true,
              detail: { id: compId },
            }),
          );

          console.log(`Competition ${compId} deleted successfully.`);
        }

        // If modal.returnValue was 'cancel', it closes silently and does nothing!
      });
    }
  }
  clearForm() {
    const form = this.querySelector('form');
    if (!form) return;

    // 1. Reset standard native fields (names, text strings) back to default baseline
    form.reset();

    // 2. Erase the top-level hidden competition ID so the next save starts fresh
    const idEl = this.querySelector('input[type="hidden"]');
    if (idEl) idEl.value = '';

    const syllabusTeams = this.querySelector('syllabus-teams');
    if (syllabusTeams) {
      syllabusTeams.clear();
    }
    const syllabusFixtures = this.querySelector('syllabus-fixtures');
    if (syllabusFixtures) {
      syllabusFixtures.clear();
    }

    this.isFormDirty = false;
    this.updateActionButtonsVisibility();
  }

  // Inside your syllabus-builder component setup
  setupSubmitListener() {
    const form = this.querySelector('form');

    form.addEventListener('submit', async e => {
      e.preventDefault(); // 1. Stop the standard page reload

      // 2. Perform your Client-Side Semantic Validation
      if (!this.validateFormState()) {
        return; // Stop the save if validation rules fail
      }

      // 3. Capture the current DOM state natively
      const formData = new FormData(form);

      try {
        const response = await fetch('/admin/competitions', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          // 1. Check the HTTP status code (e.g., 400, 403, 500)
          console.error(`Server returned status: ${response.status}`);

          try {
            // 2. Try to read the error message sent by the server
            const errorData = await response.json();
            console.error('Server error details:', errorData);
          } catch (parseError) {
            // Fallback if the server responded with plain text or HTML instead of JSON
            const errorText = await response.text();
            console.error('Server raw error text:', errorText);
          }

          return; // Stop execution since response.ok is false
        }

        const result = await response.json();

        // 4. Update your local "Save Checkpoint" state model
        this.startingModel = result.fullModel;

        const { id: competitionId } = result.competitionSummary;
        const idEl = this.querySelector('input[type="hidden"]');
        if (idEl) idEl.value = competitionId;

        this.isFormDirty = false;
        this.updateActionButtonsVisibility();

        // 5. Broadcast changes up to the sidebar selector list
        this.dispatchEvent(
          new CustomEvent('competition-saved', {
            bubbles: true,
            detail: { competition: result.competitionSummary },
          }),
        );

        // 6. Optional: Re-hydrate to ensure any fresh database IDs are set
        //this.hydrate(this.savedModelBackup);

        console.log('Checkpoint saved successfully!');
      } catch (error) {
        console.error('Network Error during save:', error);
      }
    });
  }

  validateFormState() {
    // Add your custom semantic rules here
    const teamNames = Array.from(this.querySelectorAll('.team-name')).map(el => el.value.trim());

    // Example rule: Check for duplicate team names
    const hasDuplicates = teamNames.some((name, idx) => teamNames.indexOf(name) !== idx);
    if (hasDuplicates) {
      alert('⚠️ Validation Error: Each team in this competition must have a unique name.');
      return false;
    }

    return true; // Form is valid and safe to submit
  }

  updateActionButtonsVisibility() {
    const cancelButton = this.querySelector('.cancel-edit-btn');
    const createButton = this.querySelector('.switch-to-create-btn');
    const formHeader = this.querySelector('.form-mode-title');

    // The Cancel button is HIDDEN when the form is clean (NOT dirty)
    if (cancelButton) cancelButton.classList.toggle('hidden', !this.isFormDirty);

    // The Create button is HIDDEN when the form is dirty
    if (createButton) createButton.classList.toggle('hidden', this.isFormDirty);

    if (formHeader) formHeader.textContent = 'Modify Existing Competition';

    const idEl = this.querySelector('input[type="hidden"]');
    const deleteBtn = this.querySelector('.delete-competition-btn');

    if (deleteBtn) {
      // Only show or enable the delete action if an ID exists (meaning it's an Edit, not a Create)
      const hasId = !!(idEl && idEl.value);
      deleteBtn.classList.toggle('hidden', !hasId);
    }
  }

  async onEditCompetition(competitionId) {
    try {
      // 2. FETCH PURE JSON FROM CLOUDFLARE
      const response = await fetch(`/admin/get-raw-syllabus-json?id=${competitionId}`);
      if (!response.ok) throw new Error('Could not pull competition database records.');

      const data = await response.json();

      this.hydrateForm(data);

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
  }
} // end class SyllabusBuilder

customElements.define('syllabus-builder', SyllabusBuilder);
