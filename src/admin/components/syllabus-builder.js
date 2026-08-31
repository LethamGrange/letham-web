import { SyllabusBase } from 'js/syllabus-base.js';

class SyllabusBuilder extends SyllabusBase {
  connectedCallback() {
    const form = this.querySelector('form');

    this.submitBtn = this.querySelector('button[type="submit"]');
    this.cancelBtn = this.querySelector('#cancel-syllabus-edit');
    this.syllabusFixtures = this.querySelector('syllabus-fixtures');

    // Listen for the custom event from the teams element
    this.addEventListener('teams-changed', event => {
      const updatedTeams = event.detail.teams;

      this.syllabusFixtures.updateTeams(updatedTeams); // Update the fixtures element directly
      //this.fixturesEl.updateTeams(updatedTeams);
    });

    // document.body.addEventListener("edit-syllabus-request", async (event) =>
    //   this.onEditSyllabus(event, form),
    // );
    //
    // Kick off the URL inspection quietly on page mount
    // this.loadSyllabusDataForEditing(form);

    this.cancelBtn.addEventListener('click', () => {
      // Simply redirect the browser back to the base admin page URL without parameters
      window.location.href = window.location.pathname;
    });
  } // connectedCallback

  onTeamsChange(event) {}
} // end class SyllabusBuilder

customElements.define('syllabus-builder', SyllabusBuilder);
