import { html } from 'js/html.js';

class ScorecardManager extends HTMLElement {
  errorBanner;
  submitBtn;
  lineScores;

  connectedCallback() {
    const form = this.querySelector('form');
    this.errorBanner = document.getElementById('form-error-banner');
    this.submitBtn = this.querySelector('button[type="submit"]');
    this.competitionPicker = this.querySelector('competition-picker');

    const inputA = form.querySelector('[name="team[a][name]"]');
    const inputB = form.querySelector('[name="team[b][name]');

    this.lineScores = form.querySelector('line-scores');

    // 1. RE-ACTIVE SYNC: Push text values down as attributes as the admin types
    const updateAttributes = () => {
      if (this.lineScores) {
        this.lineScores.teamA = inputA.value;
        this.lineScores.setAttribute('team-b', inputB.value);
      }
    };

    this.isFormDirty = false;
    this.startingModel = null;

    inputA?.addEventListener('input', updateAttributes);
    inputB?.addEventListener('input', updateAttributes);

    // Create a Cancel button dynamically if you haven't placed one in HTML yet
    this.cancelBtn = this.querySelector('.cancel-edit-btn');

    // 5. THE CLEAN RESET PATHway TO CREATE MODE
    // this.cancelBtn.addEventListener("click", () => this.onCancel(form));
    this.populateClubMembers();

    this.setupFormListeners(form);

    setTimeout(() => updateAttributes(), 10);

    // 1. CATCH THE BUBBLED EVENT FROM ANY DEEP MATCH CARD CLICK
    document.body.addEventListener('edit-scorecard-request', async event => this.onEditScorecard(form));

    // Event 1: Before htmx swaps data, inspect the server status code
    document.body.addEventListener('htmx:beforeOnLoad', event => this.onBeforeLoad(event, form));
  }

  setupFormListeners(form) {
    // Any input event anywhere signals a change
    form.addEventListener('input', () => {
      // ⚡️ PERFORMANCE GUARD: If we already know the form is dirty,
      // stop immediately and skip costly DOM style updates!
      if (this.isFormDirty) return;

      this.isFormDirty = true;
      this.updateActionButtonsVisibility();
    });

    // 2. Intercept successful HTMX saves
    form.addEventListener('htmx:afterRequest', event => {
      if (event.detail.successful) {
        const requestMethod = event.detail.elt.getAttribute('hx-put') ? 'PUT' : 'POST';

        if (requestMethod === 'PUT') {
          // Just lift your server-side structural mirror directly to save the new baseline
          this.commitCurrentFormToSnapshot(form);
          this.isFormDirty = false;
          this.setCancelButtonVisibility(false);
        } else {
          // POST creation clean-slate wipe out
          this.startingModel = null;
          this.isFormDirty = false;
          form.reset();

          this.querySelector('line-scores')?.onUpdateLinescores({ ends: [] });
          if (this.competitionPicker) this.competitionPicker.competitionName = '';

          this.setCancelButtonVisibility(false);
        }
      }
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
    form.querySelector('.switch-to-create-btn')?.addEventListener('click', e => {
      e.preventDefault();
      this.switchToCreateMode(form);
    });

    form.addEventListener('submit', event => this.onSubmit(event, form)); // Listen for text events to inject auto-zero placeholders up to end 12
  }

  switchToCreateMode(form) {
    // 1. Wipe memory references clean
    this.startingModel = null;
    this.isFormDirty = false;

    // 2. Swap the HTMX routing targets back to record creation
    form.removeAttribute('hx-put');
    form.setAttribute('hx-post', '/api/scorecard');

    // 3. Clear all visual field layouts to absolute defaults
    form.reset();
    const idInput = form.querySelector('[name="match_id"]');
    if (idInput) idInput.value = '';

    this.querySelector('line-scores')?.onUpdateLinescores({ ends: [] });
    if (this.competitionPicker) this.competitionPicker.competitionName = '';

    // 4. Force HTMX to re-scan the new hx-post attribute structure
    if (window.htmx) htmx.process(form);

    // 5. Update buttons
    this.updateActionButtonsVisibility();
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

      if (formHeader) formHeader.textContent = 'Modify Existing Match Scorecard';
    }

    // MODE B: Fresh creation canvas
    else {
      if (cancelButton) cancelButton.style.display = 'none';
      if (createButton) createButton.style.display = 'none';
      if (formHeader) formHeader.textContent = 'Log New Match Scorecard';
    }
  }

  commitCurrentFormToSnapshot(form) {
    const formData = new FormData(form);

    const matchDate = formData.get('match[date]');
    const matchTime = formData.get('match[time]');
    const sheet = formData.get('match[sheet]');
    const competitionName = formData.get('match[competition_name]');

    const teamAName = formData.get('team[a][name]')?.trim();
    const teamBName = formData.get('team[b][name]')?.trim();

    // 1. Gather player keys exactly like the backend structure does
    const teamplayers = {};
    for (let key of ['a', 'b']) {
      for (let player of ['skip', 'third', 'second', 'lead']) {
        teamplayers[`team_${key}_${player}`] = formData.get(`team[${key}][players][${player}]`) || '';
      }
    }

    // 2. Parse linescores into a clean, 0-indexed data array matching your layout schema
    const ends = [];
    const hasExtraEnds = formData.get('match[has_extra_ends]') === 'true' || this.toggleCheckbox?.checked === true;
    const numberOfEnds = hasExtraEnds ? 12 : 8;

    for (let i = 1; i <= numberOfEnds; i++) {
      const valA = formData.get(`ends[${i}][a]`);
      const valB = formData.get(`ends[${i}][b]`);

      ends.push({
        a: valA && valA.trim() !== '' ? parseInt(valA, 10) : '',
        b: valB && valB.trim() !== '' ? parseInt(valB, 10) : '',
      });
    }

    // 3. Save the exact structure as the unified new starting model
    this.startingModel = {
      date: matchDate,
      time: matchTime,
      sheet,
      competition_name: competitionName,
      team: {
        a: { name: teamAName },
        b: { name: teamBName },
      },
      ...teamplayers,
      ends: ends,
      // Add quick numerical cached value lookups for dirty checker shortcuts
      finalScoreA: ends.reduce((sum, val) => sum + (parseInt(val.a, 10) || 0), 0),
      finalScoreB: ends.reduce((sum, val) => sum + (parseInt(val.b, 10) || 0), 0),
    };

    // 4. Instantly dismiss the cancel button since state is now clean
    this.setCancelButtonVisibility(false);
  }

  onSubmit(event, form) {
    this.lineScores.validateAllScores({ checkGaps: true });
    // Clear any leftover server-side errors the moment they try again
    const isFormValid = event.target.checkValidity();

    if (!isFormValid) {
      // Stop htmx from sending the request to Cloudflare completely!
      event.preventDefault();
      event.stopImmediatePropagation();

      if (this.lineScores && this.lineScores.hasSemanticErrors) {
        this.lineScores.focusFirstInvalid();
      }

      // EXIT EARLY: The old server error banner stays visible
      return;
    }

    if (this.errorBanner) this.errorBanner.innerHTML = '';
  }

  // 4. Isolate the async network logic into a dedicated method
  async populateClubMembers() {
    const datalist = document.getElementById('club-members');
    if (!datalist) return;

    try {
      const response = await fetch('/admin/get-club-members');
      if (response.ok) {
        const members = await response.json();
        datalist.innerHTML = members.map(name => html`<option value="${name}"></option>`).join('');
      }
    } catch (err) {
      console.error('Background autocomplete population failed:', err);
    }
  }

  onCancelX(form) {
    form.reset();

    // Wipe s.the hidden identifier completely
    const hiddenId = form.querySelector('[name="match[id]"]');
    if (hiddenId) hiddenId.value = '';

    // Revert from PUT back to standard POST
    form.setAttribute('hx-post', '/admin/submit-scorecard');
    form.removeAttribute('hx-put');
    htmx.process(form);

    this.submitBtn.textContent = 'Log New Scorecard';
    this.cancelBtn.style.display = 'none';

    // If your competition picker element hides custom text strings on reset, trigger it
    const compSelect = form.querySelector('[name="competition_select"]');
    if (compSelect) compSelect.dispatchEvent(new Event('change'));
  }

  setCancelButtonVisibility(isVisible) {
    const cancelButton = this.cancelBtn;
    if (cancelButton) {
      cancelButton.style.display = isVisible ? 'inline-block' : 'none';
    }
  }

  hydrateForm(data, form) {
    // Still keep a shallow copy of the model so we know how to roll back if they click cancel
    this.startingModel = data;
    this.isFormDirty = false;

    // 1. Update the form element attributes to target the edit routing
    form.removeAttribute('hx-post');
    form.setAttribute('hx-put', '/api/scorecard'); // Adjust your endpoint path here

    // 1. Hydrate Match Metadata
    if (data.competition_name && this.competitionPicker) {
      this.competitionPicker.competitionName = data.competition_name;
    }

    const idInput = form.querySelector('[name="match[id]"]');
    if (idInput) idInput.value = data.id || '';

    ['date', 'time', 'sheet'].forEach(key => {
      const input = form.querySelector(`[name="match[${key}]"]`);
      if (input) input.value = data[key] || '';
    });

    // 2. Hydrate Team Data (A and B)
    ['a', 'b'].forEach(side => {
      // Set Team Names
      const nameInput = form.querySelector(`[name="team[${side}][name]"]`);
      if (nameInput) nameInput.value = data.team?.[side]?.name || '';

      // Set Player Positions
      ['skip', 'third', 'second', 'lead'].forEach(pos => {
        const pInput = form.querySelector(`[name="team[${side}][players][${pos}]"]`);
        if (pInput) pInput.value = data.team?.[side]?.players?.[pos] || '';
      });
    });

    // 3. Hydrate Linescores
    // Locate your custom <line-scores> element and pass the array straight in!
    const linescoreComponent = this.querySelector('line-scores');
    if (linescoreComponent && data.ends) {
      linescoreComponent.onUpdateLinescores(data);
    }

    // 3. Sync up the view layout states
    this.updateActionButtonsVisibility();

    // Tell HTMX to re-bind its internal event listeners to the fresh hx-put attribute
    if (window.htmx) htmx.process(form);
  }

  async onEditScorecard(form) {
    const matchId = event.detail.matchId;

    try {
      // 2. FETCH PURE JSON FROM CLOUDFLARE
      const response = await fetch(`/admin/get-raw-scorecard-json?id=${matchId}`);
      if (!response.ok) throw new Error('Could not pull scorecard database records.');

      const data = await response.json();

      this.hydrateForm(data, form);

      // 4. SWITCH FORMS METHODS IN PLACE FOR HTMX PUT CODES
      form.setAttribute('hx-put', '/admin/submit-scorecard');
      form.removeAttribute('hx-post');
      htmx.process(form); // Rebinds the active lifecycle handlers to PUT

      // Bring workspace focus smoothly into window view
      this.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      if (this.errorBanner) {
        this.errorBanner.innerHTML = html`<div style="color:var(--red-6)">⚠️ ${error.message}</div>`;
      }
    }
  }

  onBeforeLoad(event, form) {
    const status = event.detail.xhr.status;

    // 1. Handle session expiration / unauthorised access
    if (status === 401 || status === 403) {
      // Stop htmx from processing anything else
      event.detail.shouldSwap = false;

      // Grab the current path and jump to login
      const currentPath = window.location.pathname;
      window.location.href = `/login?next=${encodeURIComponent(currentPath)}`;
      return;
    }

    if (status >= 400 && status <= 599) {
      // 1. Stop htmx from swapping the error message into the #recent-results list
      event.detail.shouldSwap = false;
      // Protect against raw HTML debug pages leaking on a 500 crash
      const isHtml = event.detail.xhr.getResponseHeader('Content-Type')?.includes('text/html');
      const message = isHtml ? 'A server error occurred. Please try again later.' : event.detail.xhr.responseText;

      // Inject cleanly into our safe, managed static banner
      this.errorBanner.innerHTML = html`
        <div
          style="background: var(--red-1); color: var(--red-9); border: 1px solid var(--red-3); padding: var(--size-3); margin-bottom: var(--size-3); border-radius: var(--radius-2); font-weight: bold;"
        >
          ⚠️ ${message}
        </div>
      `;
      return;
    }

    if (status === 200) {
      this.errorBanner.innerHTML = '';

      const isJustRefreshingList = event.detail.target.id === 'recent-results';

      if (!isJustRefreshingList) {
        this.submitBtn.textContent = 'Log New Scorecard';
        this.cancelBtn.style.display = 'none';

        const compSelect = form.querySelector('[name="competition_select"]');
        if (compSelect) compSelect.dispatchEvent(new Event('change'));

        setTimeout(() => {
          form.reset();
        }, 50);
      }
    }
  }
}

if ('customElements' in window) {
  customElements.define('scorecard-manager', ScorecardManager);
}
