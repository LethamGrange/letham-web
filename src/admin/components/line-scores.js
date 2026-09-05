class LineScores extends HTMLElement {
  scorecard;
  totalAEl;
  totalBEl;
  labelA;
  labelB;

  // 1. Tell the browser what attributes to watch for changes
  static get observedAttributes() {
    return ['team-a', 'team-b'];
  }

  // 2. This callback handles changes, even if it fires BEFORE connectedCallback has run!
  attributeChangedCallback(name, oldValue, newValue) {
    // If the DOM isn't cached into our class properties yet, fall back to a direct select
    const label =
      name === 'team-a'
        ? this.labelA || this.querySelector('#label-team-a')
        : this.labelB || this.querySelector('#label-team-b');

    if (label) {
      const suffix = '';
      label.textContent =
        newValue && newValue.trim() ? `${newValue.trim()}${suffix}` : `Team ${name === 'team-a' ? 'A' : 'B'}${suffix}`;
    }
  }

  get teamA() {
    return this.getAttribute('team-a');
  }
  set teamA(value) {
    if (this.teamA !== value) {
      this.setAttribute('team-a', value);
    }
  }

  connectedCallback() {
    this.scorecard = this.querySelector('.scorecard-scroll-wrapper');

    this.labelA = this.querySelector('#label-team-a');
    this.labelB = this.querySelector('#label-team-b');

    this.totalAEl = this.querySelector('.running-total-a');
    this.totalBEl = this.querySelector('.running-total-b');

    // 2. Cache references to all 12 end rows in one clean pass
    this.cachedEnds = [];
    for (let end = 1; end <= 12; end++) {
      this.cachedEnds.push({
        end: end,
        isExtra: end > 8, // Mark ends 9-12 as extra ends
        inputA: this.querySelector(`[name="ends[${end}][a]"]`),
        inputB: this.querySelector(`[name="ends[${end}][b]"]`),
      });
    }

    this.toggleCheckbox = this.querySelector('.toggle-extra-ends');
    this.toggleCheckbox.addEventListener('change', () => this.handleExtraEndsToggle());

    this.addEventListener('input', event => this.onScorecardInput(event));

    // 2. Safely inject zeros ONLY when the user steps away from an end
    this.addEventListener('blur', e => this.onScorecardBlur(e), {
      capture: true,
    });

    setTimeout(() => {
      this.handleExtraEndsToggle();
    }, 10);
  }

  get hasSemanticErrors() {
    // Check if any of your inner inputs have an active custom validity message
    const inputs = Array.from(this.querySelectorAll('input'));
    return inputs.some(input => input.validationMessage !== '');
  }

  handleExtraEndsToggle() {
    if (!this.toggleCheckbox) return;
    const showExtra = this.toggleCheckbox.checked;

    // 1. Let your CSS handle the visual layout changes
    if (this.scorecard) {
      this.scorecard.classList.toggle('show-extras', showExtra);
    }

    // 2. Control database serialization by disabling/enabling hidden inputs
    this.cachedEnds.forEach(row => {
      if (row.isExtra) {
        if (row.inputA) row.inputA.disabled = !showExtra;
        if (row.inputB) row.inputB.disabled = !showExtra;
      }
    });

    // 3. Keep validation states and aggregates updated in real time
    this.validateAllScores();
    this.updateRunningTotals();
  }

  onScorecardBlur(event) {
    if (!event.target.matches('input[type="number"]')) return;

    const currentInput = event.target;
    const currentName = currentInput.name;

    // Deduces the opponent name dynamically from the brackets
    const opponentName = currentName.endsWith('[a]')
      ? currentName.replace('[a]', '[b]')
      : currentName.replace('[b]', '[a]');
    const opponentInput = this.querySelector(`[name="${opponentName}"]`);

    if (!opponentInput) return;

    const currentValue = parseInt(currentInput.value, 10) || 0;
    const opponentValue = parseInt(opponentInput.value, 10) || 0;

    // If I just finished typing a score, and my opponent's field is totally blank, fill it with a 0
    if (currentValue > 0 && opponentInput.value === '') {
      opponentInput.value = 0;
    }
    // If my opponent has a score, and I left my field totally blank, fill mine with a 0
    if (opponentValue > 0 && currentInput.value === '') {
      currentInput.value = 0;
    }

    // Refresh everything once values settle
    this.validateAllScores();
    this.updateRunningTotals();
  }
  validateSingleEnd(end, inputA, inputB, isSkipped = false) {
    if (!inputA || !inputB) return { isInvalid: false, label: '' };

    const rawA = inputA.value.trim();
    const rawB = inputB.value.trim();

    const scoreA = parseInt(rawA, 10) || 0;
    const scoreB = parseInt(rawB, 10) || 0;

    // Clear previous validation states
    inputA.setCustomValidity('');
    inputB.setCustomValidity('');
    inputA.classList.remove('is-invalid');
    inputB.classList.remove('is-invalid');

    const endLabel = end <= 10 ? `End ${end}` : end === 11 ? 'EE' : 'EEE';

    // RULE 1: Skipped End Detection
    if (isSkipped && rawA === '' && rawB === '') {
      const errorMsg = `This end cannot be left completely blank if subsequent ends have scores. Enter 0 for both teams if it was a blank end.`;
      inputA.setCustomValidity(errorMsg);
      inputB.setCustomValidity(errorMsg);
      inputA.classList.add('is-invalid');
      inputB.classList.add('is-invalid');
      return { isInvalid: true, label: endLabel, type: 'skipped' };
    }

    // RULE 2: Both teams cannot score in the same end
    if (scoreA > 0 && scoreB > 0) {
      const errorMsg = `Both teams cannot score in the same end.`;
      inputA.setCustomValidity(errorMsg);
      inputB.setCustomValidity(errorMsg);
      inputA.classList.add('is-invalid');
      inputB.classList.add('is-invalid');
      return { isInvalid: true, label: endLabel, type: 'conflict' };
    }

    return { isInvalid: false, label: '', type: '' };
  }

  // 2. Used when setLinescores() or bulk data updates occur
  validateAllScores({ checkGaps = false } = {}) {
    let lastActiveEnd = 0;

    // Pass 1: Find the furthest end with a value (using the cache)
    if (checkGaps) {
      for (const row of this.cachedEnds) {
        // CRITICAL: If the input is disabled, it doesn't exist to our layout pipeline
        if (row.inputA?.disabled || row.inputB?.disabled) continue;

        if (row.inputA?.value.trim() !== '' || row.inputB?.value.trim() !== '') {
          lastActiveEnd = row.end;
        }
      }
    }

    let formHasErrors = false;
    let firstErrorLabel = '';
    let errorType = '';

    // Pass 2: Run validation loop using the exact same cache
    for (const row of this.cachedEnds) {
      // CRITICAL: If extra ends are hidden and disabled, clear their legacy errors and skip them!
      if (row.inputA?.disabled || row.inputB?.disabled) {
        row.inputA?.setCustomValidity('');
        row.inputB?.setCustomValidity('');
        row.inputA?.classList.remove('is-invalid');
        row.inputB?.classList.remove('is-invalid');
        continue;
      }
      // A gap is only checked if checkGaps is true AND this end index is behind our furthest entry
      const isSkipped = checkGaps && row.end < lastActiveEnd;

      const result = this.validateSingleEnd(row.end, row.inputA, row.inputB, isSkipped);

      if (result.isInvalid && !formHasErrors) {
        formHasErrors = true;
        firstErrorLabel = result.label;
        errorType = result.type;
      }
    }

    // Update the macro text wrapper at the bottom
    const messageEl = this.querySelector('.linescore-error-message');
    if (formHasErrors) {
      if (errorType === 'skipped') {
        messageEl.textContent = `Invalid Scorecard: ${firstErrorLabel} has been skipped. Please enter scores or fill 0-0 for a blank end.`;
      } else {
        messageEl.textContent = `Invalid Scorecard: Both teams cannot score points in ${firstErrorLabel}. One side must be 0 or blank.`;
      }
    } else {
      messageEl.textContent = '';
    }
  }

  // 3. Used for speedy live typing updates
  onScorecardInput(event) {
    if (!event.target.matches('input[type="number"]')) return;
    // Run the shared single end evaluator to toggle invalid states instantly
    this.validateAllScores();

    // RUN THE TOTAL UPDATE IN REAL TIME 🧮
    this.updateRunningTotals();
  }

  // Helper function to calculate math for all 12 ends dynamically
  updateRunningTotals() {
    let totalA = 0;
    let totalB = 0;

    this.cachedEnds.forEach(row => {
      // Only add up the scores if the inputs are active and enabled!
      if (row.inputA && !row.inputA.disabled) {
        totalA += parseInt(row.inputA.value, 10) || 0;
      }
      if (row.inputB && !row.inputB.disabled) {
        totalB += parseInt(row.inputB.value, 10) || 0;
      }
    });
    // Push the fresh values straight into the UI text nodes
    this.totalAEl.textContent = totalA;
    this.totalBEl.textContent = totalB;
  }

  focusFirstInvalid() {
    // Find the first input containing an active semantic error message
    const firstInvalidInput = Array.from(this.querySelectorAll('input')).find(input => input.validationMessage !== '');

    if (firstInvalidInput) {
      // Smoothly scroll the row into view so the user has context
      firstInvalidInput.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      // Move keyboard focus to it
      firstInvalidInput.focus();
    }
  }

  // DYNAMIC NAME SYNC FUNCTION
  syncLabels(inputA, inputB) {
    // If a name is typed, show it. Otherwise, fall back to the defaults.
    this.labelA.textContent = inputA?.trim() || 'Team A';
    this.labelB.textContent = inputB?.trim() || 'Team B';
  }

  onUpdateLinescores(data) {
    Object.keys(data).forEach(key => {
      const input = this.scorecard.querySelector(`[name="${key}"]`);
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = !!data[key];
        } else {
          input.value = data[key] !== null ? data[key] : '';
        }
      }
    });

    this.updateRunningTotals();
    this.validateAllScores(true);
    // alert('test');
  }

  onUpdateLinescores(data) {
    const hasExtraEnds = data.ends.length > 8;

    // 1. First handle top-level toggles if present in the data object
    if (this.toggleCheckbox) {
      this.toggleCheckbox.checked = hasExtraEnds;
      this.handleExtraEndsToggle();
    }

    // If you pass clean 0-indexed arrays instead:
    this.cachedEnds.forEach(row => {
      const vals = data.ends?.[row.end - 1] ?? { a: '', b: '' };

      const valA = vals.a ?? '';
      const valB = vals.b ?? '';

      if (row.inputA) row.inputA.value = valA;
      if (row.inputB) row.inputB.value = valB;
    });

    // 3. Re-run structural calculations after everything is safely populated
    this.updateRunningTotals();
    this.validateAllScores({ checkGaps: true });
  }
}

if ('customElements' in window) {
  customElements.define('line-scores', LineScores);
}
