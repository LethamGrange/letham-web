class SyllabusBuilder extends HTMLElement {
  connectedCallback() {
    const form = this.querySelector('form');
    const teamsContainer = this.querySelector('#teams-input-container');
    const drawsContainer = this.querySelector('#draw-dates-container');
    const fixturesZone = this.querySelector('#fixtures-zone');
    const submitBtn = this.querySelector('button[type="submit"]');
    const cancelBtn = this.querySelector('#cancel-syllabus-edit');
    const addTeamBtn = this.querySelector('#add-team-btn');

    // Fixture controls
    const addDrawBtn = this.querySelector('#add-draw-btn');

    // State counts tracked across mutations
    let currentTeamCount = 0;
    let currentDrawCount = 0;

    const getActiveTeamOptions = count => {
      let options = `<option value="">-- Select Team --</option>`;
      for (let i = 1; i <= count; i++) {
        const input = teamsContainer.querySelector(`[name="team_name_${i}"]`);
        const nameValue = input && input.value.trim() ? input.value.trim() : `Team ${i}`;
        options += `<option value="${i}">${nameValue}</option>`;
      }
      return options;
    };

    // Inside your SyllabusBuilder class, update the addTeamBtn listener:

    addTeamBtn.addEventListener('click', () => {
      currentTeamCount++;

      const div = document.createElement('div');
      div.className = 'team-entry-card';
      div.style.cssText =
        'border: 1px solid var(--border); padding: var(--size-2); border-radius: var(--radius-1); background: var(--surface-2);';

      // Base Rink Name Input
      let html = `
       <div style="margin-bottom: 8px;">
         <label style="font-weight: bold;">Team ${currentTeamCount} Rink Name:</label>
         <input type="text" name="team_name_${currentTeamCount}" placeholder="e.g., Team Smith" style="width:100%;" required>
       </div>
       <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
     `;

      html += `
         <div>
           <label style="font-size: var(--font-size-0); color: var(--text-2);">Team Roster (Add (s) after the skip's name)</label>
           <input type="text" name="team_${currentTeamCount}_roster" />
         </div>
       `;

      // Pool Players text field
      html += `
       <div>
         <label style="font-size: var(--font-size-0); color: var(--text-2);">Pool / Sub Players (Comma separated):</label>
         <input type="text" name="team_${currentTeamCount}_pool" placeholder="e.g. Brian McArtney, Jim Menzies" style="width:100%;">
       </div>
     `;

      div.innerHTML = html;

      // Keep your live dropdown text sync listening to the Rink Name box
      div.querySelector('input[type="text"]').addEventListener('input', updateAllFixtureDropdowns);
      teamsContainer.appendChild(div);

      if (currentTeamCount >= 2) {
        fixturesZone.style.display = 'block';
      }
    });

    // ==========================================
    // THE HYBRID MATRIX RE-BUILDER CODE
    // ==========================================
    document.body.addEventListener('edit-syllabus-request', async event => {
      const compId = event.detail.compId;

      try {
        const response = await fetch(`/admin/get-raw-syllabus-json?id=${compId}`);
        if (!response.ok) throw new Error('Could not download competition schema profile.');
        const data = await response.json();

        // 1. Assign Basic Metadata Inputs
        form.querySelector('[name="competition_id"]').value = data.competition_id;
        form.querySelector('[name="competition_name"]').value = data.competition_name;
        form.querySelector('[name="competition_kind"]').value = data.competition_kind;
        form.querySelector('[name="competition_reserves"]').value = data.competition_reserves;

        // 2. Programmatically generate the exact number of Team Cards
        teamsContainer.innerHTML = '';
        currentTeamCount = 0;

        data.teams.forEach(t => {
          currentTeamCount++;
          const div = document.createElement('div');
          div.className = 'team-entry-card';
          div.style.cssText =
            'border: 1px solid var(--border); padding: var(--size-2); border-radius: var(--radius-1); background: var(--surface-2);';
          div.innerHTML = `
               <div style="margin-bottom: 8px;">
                 <label style="font-weight: bold;">Team ${currentTeamCount} Rink Name:</label>
                 <input type="text" name="team_name_${currentTeamCount}" value="${t.team_name}" style="width:100%;" required>
               </div>
               <div>
                 <label style="font-size: var(--font-size-0); color: var(--text-2);">Team Roster (Comma separated, append (s) for skip):</label>
                 <input type="text" name="team_${currentTeamCount}_roster" value="${t.roster_string}" list="club-members" style="width:100%;">
               </div>
               <div style="margin-top: 4px;">
                 <label style="font-size: var(--font-size-0); color: var(--text-2);">Sub / Pool Players (Comma separated):</label>
                 <input type="text" name="team_${currentTeamCount}_pool" value="${t.pool_string}" list="club-members" style="width:100%;">
               </div>
             `;
          div.querySelector('input[type="text"]').addEventListener('input', updateAllFixtureDropdowns);
          teamsContainer.appendChild(div);
        });

        // 3. Programmatically generate the dynamic Fixtures blocks grid
        drawsContainer.innerHTML = '';
        currentDrawCount = 0;
        fixturesZone.style.display = 'block';

        data.draws.forEach(draw => {
          currentDrawCount++;
          const drawBlock = document.createElement('div');
          drawBlock.className = 'draw-round-block';
          drawBlock.style.cssText =
            'border: 1px dashed var(--border); padding: 15px; margin-bottom: 15px; background: var(--surface-1);';

          let html = `
               <div style="display: flex; gap: 15px; margin-bottom: 10px;">
                 <div><label>Draw Date:</label><br><input type="date" name="draw_date_${currentDrawCount}" value="${draw.date}" required></div>
                 <div><label>Draw Time:</label><br><input type="time" name="draw_time_${currentDrawCount}" value="${draw.time}" required></div>
               </div>
               <h4>Sheet Matchups</h4>
             `;

          const teamOptions = getActiveTeamOptions(currentTeamCount);
          const sheets = ['A', 'B', 'C', 'D', 'E', 'F'];

          draw.games.forEach((game, gIndex) => {
            html += `
                 <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px;">
                   <select name="draw_${currentDrawCount}_game_${gIndex}_sheet">
                     ${sheets.map(s => `<option value="${s}" ${s === game.sheet ? 'selected' : ''}>Sheet ${s}</option>`).join('')}
                   </select>
                   <select name="draw_${currentDrawCount}_game_${gIndex}_team_a" class="team-select-node" required>${teamOptions}</select>
                   <span>vs</span>
                   <select name="draw_${currentDrawCount}_game_${gIndex}_team_b" class="team-select-node" required>${teamOptions}</select>
                 </div>
               `;
          });

          drawBlock.innerHTML = html;
          drawsContainer.appendChild(drawBlock);

          // Reapply the specific dropdown index values once the HTML payload node exists!
          draw.games.forEach((game, gIndex) => {
            drawBlock.querySelector(`[name="draw_${currentDrawCount}_game_${gIndex}_team_a"]`).value = game.team_a;
            drawBlock.querySelector(`[name="draw_${currentDrawCount}_game_${gIndex}_team_b"]`).value = game.team_b;
          });
        });

        // 4. TRANSITION THE FORM HOOK FOR ACTION METHODS VIA HTMX
        form.setAttribute('hx-put', '/functions/admin/submit-complete-syllabus');
        form.removeAttribute('hx-post');
        htmx.process(form);

        submitBtn.textContent = 'Save Schedule Revisions 💾';
        cancelBtn.style.display = 'inline-block';
        this.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        console.error('Syllabus mapper extraction exception:', err);
      }
    });

    // ==========================================
    // NEW: AUTO-LOAD EXTRACTOR ON PAGE INITIALIZATION
    // ==========================================
    const checkUrlForEditId = async () => {
      // Look at the address bar parameters (e.g., /admin/syllabus?id=42)
      const urlParams = new URLSearchParams(window.location.search);
      const compId = urlParams.get('id');

      // If an ID exists in the URL, immediately fetch and map the JSON data!
      if (compId) {
        try {
          const response = await fetch(`/admin/get-raw-syllabus-json?id=${compId}`);
          if (!response.ok) throw new Error('Could not download competition schema profile.');
          const data = await response.json();

          // Execute your exact existing mapping routine here...
          // [Paste your existing fields, teams loop, and fixtures loop mapping code right here]

          // Upgrade form methods for PUT revisions
          form.setAttribute('hx-put', '/admin/submit-complete-syllabus');
          form.removeAttribute('hx-post');
          // htmx.process(form);

          this.querySelector('button[type="submit"]').textContent = 'Save Schedule Revisions 💾';
          this.querySelector('#cancel-syllabus-edit').style.display = 'inline-block';
        } catch (err) {
          console.error('Auto-load edit mapping failed:', err);
        }
      }
    };
    // Add this helper function inside your SyllabusBuilder class
    const reindexFormElements = () => {
      const teamsContainer = this.querySelector('#teams-input-container');
      const drawsContainer = this.querySelector('#draw-dates-container');

      // 1. Re-index Team Cards
      const teamCards = teamsContainer.querySelectorAll('.team-entry-card');
      teamCards.forEach((card, index) => {
        const newIdx = index + 1;
        card.querySelector('label').innerHTML = `Team ${newIdx} Rink Name:`;
        card.querySelector('input[type="text"]').name = `team_name_${newIdx}`;

        const rosterInput = card.querySelector(`[name$="_roster"]`);
        if (rosterInput) rosterInput.name = `team_${newIdx}_roster`;

        const poolInput = card.querySelector(`[name$="_pool"]`);
        if (poolInput) poolInput.name = `team_${newIdx}_pool`;
      });

      // Update teamCount tracking state
      this.currentTeamCount = teamCards.length;

      // 2. Re-index Draw Blocks
      const drawBlocks = drawsContainer.querySelectorAll('.draw-round-block');
      drawBlocks.forEach((block, dIdx) => {
        const newDIdx = dIdx + 1;

        block.querySelector('[name^="draw_date_"]').name = `draw_date_${newDIdx}`;
        block.querySelector('[name^="draw_time_"]').name = `draw_time_${newDIdx}`;

        const gameRows = block.querySelectorAll('.game-row');
        gameRows.forEach((row, gIdx) => {
          row.querySelector('select[name*="_sheet"]').name = `draw_${newDIdx}_game_${gIdx}_sheet`;
          row.querySelector('select[name*="_team_a"]').name = `draw_${newDIdx}_game_${gIdx}_team_a`;
          row.querySelector('select[name*="_team_b"]').name = `draw_${newDIdx}_game_${gIdx}_team_b`;
        });
      });

      // Update drawCount tracking state and sync dropdown text
      this.currentDrawCount = drawBlocks.length;
      updateAllFixtureDropdowns();
    };

    const loadSyllabusDataForEditing = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const compId = urlParams.get('id');

      if (!compId) return; // Exit quietly if we are just creating a new syllabus

      try {
        const response = await fetch(`/admin/get-raw-syllabus-json?id=${compId}`);
        if (!response.ok) throw new Error('Could not download competition schema profile.');
        const data = await response.json();

        // 1. Map Overarching Structural Form Fields
        form.querySelector('[name="competition_id"]').value = data.competition_id;
        form.querySelector('[name="competition_name"]').value = data.competition_name;
        form.querySelector('[name="competition_kind"]').value = data.competition_kind;
        form.querySelector('[name="competition_reserves"]').value = data.competition_reserves;

        // 2. Programmatically generate and populate Team Cards
        teamsContainer.innerHTML = '';
        currentTeamCount = 0;

        data.teams.forEach(t => {
          currentTeamCount++;
          const div = document.createElement('div');
          div.className = 'team-entry-card';
          div.style.cssText =
            'border: 1px solid var(--border); padding: var(--size-2); border-radius: var(--radius-1); background: var(--surface-2);';
          div.innerHTML = `
 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
    <label style="font-weight: bold;">Team ${currentTeamCount} Rink Name:</label>
    <button type="button" class="remove-row-btn" style="background:none; border:none; color:var(--red-6); cursor:pointer;">✕ Remove</button>
  </div>
            <div style="margin-bottom: 8px;">
              <label style="font-weight: bold;">Team ${currentTeamCount} Rink Name:</label>
              <input type="text" name="team_name_${currentTeamCount}" value="${t.team_name}" style="width:100%;" required>
            </div>
            <div>
              <label style="font-size: var(--font-size-0); color: var(--text-2);">Team Roster:</label>
              <input type="text" name="team_${currentTeamCount}_roster" value="${t.roster_string}" list="club-members" style="width:100%;">
            </div>
            <div style="margin-top: 4px;">
              <label style="font-size: var(--font-size-0); color: var(--text-2);">Sub / Pool Players:</label>
              <input type="text" name="team_${currentTeamCount}_pool" value="${t.pool_string}" list="club-members" style="width:100%;">
            </div>
          `;
          div.querySelector('.remove-row-btn').addEventListener('click', () => {
            div.remove();
            reindexFormElements(); // Automatically updates names dynamically!
          });
          div.querySelector('input[type="text"]').addEventListener('input', updateAllFixtureDropdowns);
          teamsContainer.appendChild(div);
        });

        // 3. Programmatically generate and populate Draw Fixture Rows
        drawsContainer.innerHTML = '';
        currentDrawCount = 0;
        fixturesZone.style.display = 'block';

        data.draws.forEach(draw => {
          currentDrawCount++;
          const drawBlock = document.createElement('div');
          drawBlock.className = 'draw-round-block';
          drawBlock.style.cssText =
            'border: 1px dashed var(--border); padding: 15px; margin-bottom: 15px; background: var(--surface-1);';

          let html = `
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 5px;">
    <div style="display: flex; gap: 15px;">
      <div><label>Draw Date:</label><br><input type="date" name="draw_date_${currentDrawCount}" value="${draw?.date || ''}" required></div>
      <div><label>Draw Time:</label><br><input type="time" name="draw_time_${currentDrawCount}" value="${draw?.time || ''}" required></div>
    </div>

    <!-- THE FORM WORKSPACE DELETE BUTTON -->
    <button type="button" class="remove-draw-btn" style="background: none; border: 1px solid var(--red-3); color: var(--red-6); padding: var(--size-1) var(--size-2); border-radius: var(--radius-1); cursor: pointer; font-size: var(--font-size-0); font-weight: bold;">
      ✕ Delete Draw Round
    </button>
  </div>
  <h4>Sheet Matchups</h4>
`;
          const teamOptions = getActiveTeamOptions(currentTeamCount);
          const sheets = ['A', 'B', 'C', 'D', 'E', 'F'];

          draw.games.forEach((game, gIndex) => {
            html += `
              <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px;">
                <select name="draw_${currentDrawCount}_game_${gIndex}_sheet">
                  ${sheets.map(s => `<option value="${s}" ${s === game.sheet ? 'selected' : ''}>Sheet ${s}</option>`).join('')}
                </select>
                <select name="draw_${currentDrawCount}_game_${gIndex}_team_a" class="team-select-node" required>${teamOptions}</select>
                <span>vs</span>
                <select name="draw_${currentDrawCount}_game_${gIndex}_team_b" class="team-select-node" required>${teamOptions}</select>
              </div>
            `;
          });

          drawBlock.innerHTML = html;

          drawBlock.querySelector('.remove-draw-btn').addEventListener('click', () => {
            drawBlock.remove();
            reindexFormElements(); // Automatically re-sequences draw_date_1, draw_date_2 etc.!
          });
          drawsContainer.appendChild(drawBlock);
          // Force the correct dropdown indices to bind once the elements are rendered
          draw.games.forEach((game, gIndex) => {
            drawBlock.querySelector(`[name="draw_${currentDrawCount}_game_${gIndex}_team_a"]`).value = game.team_a;
            drawBlock.querySelector(`[name="draw_${currentDrawCount}_game_${gIndex}_team_b"]`).value = game.team_b;
          });
        });

        // 4. Safely swap form attributes over to true PUT methods
        form.setAttribute('hx-put', '/functions/admin/submit-complete-syllabus');
        form.removeAttribute('hx-post');
        // htmx.process(form); // Explicitly tell htmx to re-index the method update

        submitBtn.textContent = 'Save Schedule Revisions 💾';
        cancelBtn.style.display = 'inline-block';
      } catch (err) {
        console.error('Auto-load edit mapping failed:', err);
      }
    };

    // Kick off the URL inspection quietly on page mount
    loadSyllabusDataForEditing();
    // // Handle Reset Cancellation
    //  cancelBtn.addEventListener('click', () => {
    //    form.reset();
    //    form.querySelector('[name="competition_id"]').value = '';
    //    teamsContainer.innerHTML = '';
    //    drawsContainer.innerHTML = '';
    //    fixturesZone.style.display = 'none';
    //    currentTeamCount = 0;
    //    currentDrawCount = 0;
    //
    //    form.setAttribute('hx-post', '/functions/admin/submit-complete-syllabus');
    //    form.removeAttribute('hx-put');
    //    htmx.process(form);
    //
    //    submitBtn.textContent = "Save Complete Competition & Schedule 💾";
    //    cancelBtn.style.display = 'none';
    //  });

    cancelBtn.addEventListener('click', () => {
      // Simply redirect the browser back to the base admin page URL without parameters
      window.location.href = window.location.pathname;
    });

    // 2. ADD DRAW ROUND CLICK HANDLER (Remains consistent)
    addDrawBtn.addEventListener('click', () => {
      drawCount++;
      const totalGamesNeeded = Math.floor(currentTeamCount / 2); // 6 teams = 3 games

      const drawBlock = document.createElement('div');
      drawBlock.className = 'draw-round-block';
      drawBlock.style.cssText =
        'border: 1px dashed var(--border); padding: 15px; margin-bottom: 15px; background: var(--surface-1);';

      let html = `
           <div style="display: flex; gap: 15px; margin-bottom: 10px;">
             <div><label>Draw Date:</label><br><input type="date" name="draw_date_${currentDrawCount}" required></div>
             <div><label>Draw Time:</label><br><input type="time" name="draw_time_${currentDrawCount}" required></div>
           </div>
           <h4>Sheet Matchups</h4>
         `;

      const teamOptions = getActiveTeamOptions();
      const sheets = ['A', 'B', 'C', 'D', 'E', 'F'];

      // Draw standard game row fields up to rink size limits
      for (let g = 0; g < Math.min(totalGamesNeeded, 6); g++) {
        html += `
             <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px;">
               <select name="draw_${currentDrawCount}_game_${g}_sheet">
                 ${sheets.map(s => `<option value="${s}" ${s === sheets[g] ? 'selected' : ''}>Sheet ${s}</option>`).join('')}
               </select>
               <select name="draw_${currentDrawCount}_game_${g}_team_a" class="team-select-node" required>${teamOptions}</select>
               <span>vs</span>
               <select name="draw_${currentDrawCount}_game_${g}_team_b" class="team-select-node" required>${teamOptions}</select>
             </div>
           `;
      }

      drawBlock.innerHTML = html;
      drawsContainer.appendChild(drawBlock);
    });

    // Utility: Live synchronization updater strings text fields names down to fixtures options nodes
    function updateAllFixtureDropdowns() {
      const selectNodes = drawsContainer.querySelectorAll('.team-select-node');
      selectNodes.forEach(select => {
        const savedValue = select.value;
        select.innerHTML = getActiveTeamOptions();
        select.value = savedValue; // Preserves choice securely
      });
    }
  }
}
customElements.define('syllabus-builder', SyllabusBuilder);
