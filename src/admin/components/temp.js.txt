    async loadSyllabusDataForEditing(form) {
      const urlParams = new URLSearchParams(window.location.search);
      const compId = urlParams.get("id");

      if (!compId) return; // Exit quietly if we are just creating a new syllabus

      try {
        const response = await fetch(
          `/admin/get-raw-syllabus-json?id=${compId}`,
        );
        if (!response.ok)
          throw new Error("Could not download competition schema profile.");
        const data = await response.json();

        // 1. Map Overarching Structural Form Fields
        form.querySelector('[name="competition_id"]').value =
          data.competition_id;
        form.querySelector('[name="competition_name"]').value =
          data.competition_name;
        form.querySelector('[name="competition_kind"]').value =
          data.competition_kind;
        form.querySelector('[name="competition_reserves"]').value =
          data.competition_reserves;

        // 2. Programmatically generate and populate Team Cards
        this.teamsContainer.innerHTML = "";
        this.currentTeamCount = 0;

        data.teams.forEach((t) => {
          this.currentTeamCount++;
          const div = document.createElement("div");
          div.className = "team-entry-card";
          div.style.cssText =
            "border: 1px solid var(--border); padding: var(--size-2); border-radius: var(--radius-1); background: var(--surface-2);";
          div.innerHTML = html`
            <div
              style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"
            >
              <label style="font-weight: bold;"
                >Team ${this.currentTeamCount} Rink Name:</label
              >
              <button
                type="button"
                class="remove-row-btn"
                style="background:none; border:none; color:var(--red-6); cursor:pointer;"
              >
                ✕ Remove
              </button>
            </div>
            <div style="margin-bottom: 8px;">
              <label style="font-weight: bold;"
                >Team ${this.currentTeamCount} Rink Name:</label
              >
              <input
                type="text"
                name="team_name_${this.currentTeamCount}"
                value="${t.team_name}"
                style="width:100%;"
                required
              />
            </div>
            <div>
              <label
                style="font-size: var(--font-size-0); color: var(--text-2);"
                >Team Roster:</label
              >
              <input
                type="text"
                name="team_${this.currentTeamCount}_roster"
                value="${t.roster_string}"
                list="club-members"
                style="width:100%;"
              />
            </div>
            <div style="margin-top: 4px;">
              <label
                style="font-size: var(--font-size-0); color: var(--text-2);"
                >Sub / Pool Players:</label
              >
              <input
                type="text"
                name="team_${this.currentTeamCount}_pool"
                value="${t.pool_string}"
                list="club-members"
                style="width:100%;"
              />
            </div>
          `;
          div.querySelector(".remove-row-btn").addEventListener("click", () => {
            div.remove();
            this.reindexFormElements(); // Automatically updates names dynamically!
          });
          div
            .querySelector('input[type="text"]')
            .addEventListener("input", this.updateAllFixtureDropdowns);
          this.teamsContainer.appendChild(div);
        });

        // 3. Programmatically generate and populate Draw Fixture Rows
        this.drawsContainer.innerHTML = "";
        this.currentDrawCount = 0;
        this.fixturesZone.style.display = "block";

        data.draws.forEach((draw) => {
          this.currentDrawCount++;
          const drawBlock = document.createElement("div");
          drawBlock.className = "draw-round-block";
          drawBlock.style.cssText =
            "border: 1px dashed var(--border); padding: 15px; margin-bottom: 15px; background: var(--surface-1);";

          let drawsHtml = html`
            <div
              style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 5px;"
            >
              <div style="display: flex; gap: 15px;">
                <div>
                  <label>Draw Date:</label><br /><input
                    type="date"
                    name="draw_date_${this.currentDrawCount}"
                    value="${draw?.date || ""}"
                    required
                  />
                </div>
                <div>
                  <label>Draw Time:</label><br /><input
                    type="time"
                    name="draw_time_${this.currentDrawCount}"
                    value="${draw?.time || ""}"
                    required
                  />
                </div>
              </div>

              <!-- THE FORM WORKSPACE DELETE BUTTON -->
              <button
                type="button"
                class="remove-draw-btn"
                style="background: none; border: 1px solid var(--red-3); color: var(--red-6); padding: var(--size-1) var(--size-2); border-radius: var(--radius-1); cursor: pointer; font-size: var(--font-size-0); font-weight: bold;"
              >
                ✕ Delete Draw Round
              </button>
            </div>
            <h4>Sheet Matchups</h4>
          `;
          const teamOptions = this.getActiveTeamOptions(this.currentTeamCount);
          const sheets = ["A", "B", "C", "D", "E", "F"];

          draw.games.forEach((game, gIndex) => {
            drawsHtml += html`
              <div
                style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px;"
              >
                <select
                  name="draw_${this.currentDrawCount}_game_${gIndex}_sheet"
                >
                  ${sheets.map((s) => `<option value="${s}" ${s === game.sheet ? "selected" : ""}>Sheet ${s}</option>`).join("")}
                </select>
                <select
                  name="draw_${this.currentDrawCount}_game_${gIndex}_team_a"
                  class="team-select-node"
                  required
                >
                  ${teamOptions}
                </select>
                <span>vs</span>
                <select
                  name="draw_${this.currentDrawCount}_game_${gIndex}_team_b"
                  class="team-select-node"
                  required
                >
                  ${teamOptions}
                </select>
              </div>
            `;
          });

          drawBlock.innerHTML = drawsHtml;

          drawBlock
            .querySelector(".remove-draw-btn")
            .addEventListener("click", () => {
              drawBlock.remove();
              this.reindexFormElements(); // Automatically re-sequences draw_date_1, draw_date_2 etc.!
            });
          this.drawsContainer.appendChild(drawBlock);
          // Force the correct dropdown indices to bind once the elements are rendered
          draw.games.forEach((game, gIndex) => {
            drawBlock.querySelector(
              `[name="draw_${this.currentDrawCount}_game_${gIndex}_team_a"]`,
            ).value = game.team_a;
            drawBlock.querySelector(
              `[name="draw_${this.currentDrawCount}_game_${gIndex}_team_b"]`,
            ).value = game.team_b;
          });
        });

        // 4. Safely swap form attributes over to true PUT methods
        form.setAttribute(
          "hx-put",
          "/functions/admin/submit-complete-syllabus",
        );
        form.removeAttribute("hx-post");
        // htmx.process(form); // Explicitly tell htmx to re-index the method update

        this.submitBtn.textContent = "Save Schedule Revisions 💾";
        this.cancelBtn.style.display = "inline-block";
      } catch (err) {
        console.error("Auto-load edit mapping failed:", err);
      }
    }


        async onEditSyllabus(event, form) {
      const compId = event.detail.compId;

      try {
        const response = await fetch(
          `/admin/get-raw-syllabus-json?id=${compId}`,
        );
        if (!response.ok)
          throw new Error("Could not download competition schema profile.");
        const data = await response.json();

        // 1. Assign Basic Metadata Inputs
        form.querySelector('[name="competition_id"]').value =
          data.competition_id;
        form.querySelector('[name="competition_name"]').value =
          data.competition_name;
        form.querySelector('[name="competition_kind"]').value =
          data.competition_kind;
        form.querySelector('[name="competition_reserves"]').value =
          data.competition_reserves;

        // 2. Programmatically generate the exact number of Team Cards
        this.teamsContainer.innerHTML = "";
        this.currentTeamCount = 0;

        data.teams.forEach((t) => {
          this.currentTeamCount++;
          const div = document.createElement("div");
          div.className = "team-entry-card";
          div.style.cssText =
            "border: 1px solid var(--border); padding: var(--size-2); border-radius: var(--radius-1); background: var(--surface-2);";
          div.innerHTML = html`
            <div style="margin-bottom: 8px;">
              <label style="font-weight: bold;"
                >Team ${this.currentTeamCount} Rink Name:</label
              >
              <input
                type="text"
                name="team_name_${this.currentTeamCount}"
                value="${t.team_name}"
                style="width:100%;"
                required
              />
            </div>
            <div>
              <label
                style="font-size: var(--font-size-0); color: var(--text-2);"
                >Team Roster (Comma separated, append (s) for skip):</label
              >
              <input
                type="text"
                name="team_${this.currentTeamCount}_roster"
                value="${t.roster_string}"
                list="club-members"
                style="width:100%;"
              />
            </div>
            <div style="margin-top: 4px;">
              <label
                style="font-size: var(--font-size-0); color: var(--text-2);"
                >Sub / Pool Players (Comma separated):</label
              >
              <input
                type="text"
                name="team_${this.rrentTeamCount}_pool"
                value="${t.pool_string}"
                list="club-members"
                style="width:100%;"
              />
            </div>
          `;
          div
            .querySelector('input[type="text"]')
            .addEventListener("input", this.updateAllFixtureDropdowns);
          this.teamsContainer.appendChild(div);
        });

        // 3. Programmatically generate the dynamic Fixtures blocks grid
        this.drawsContainer.innerHTML = "";
        this.currentDrawCount = 0;
        this.fixturesZone.style.display = "block";

        data.draws.forEach((draw) => {
          this.currentDrawCount++;
          const drawBlock = document.createElement("div");
          drawBlock.className = "draw-round-block";
          drawBlock.style.cssText =
            "border: 1px dashed var(--border); padding: 15px; margin-bottom: 15px; background: var(--surface-1);";

          let drawsHtml = html`
            <div style="display: flex; gap: 15px; margin-bottom: 10px;">
              <div>
                <label>Draw Date:</label><br /><input
                  type="date"
                  name="draw_date_${this.currentDrawCount}"
                  value="${draw.date}"
                  required
                />
              </div>
              <div>
                <label>Draw Time:</label><br /><input
                  type="time"
                  name="draw_time_${this.currentDrawCount}"
                  value="${draw.time}"
                  required
                />
              </div>
            </div>
            <h4>Sheet Matchups</h4>
          `;

          const teamOptions = this.getActiveTeamOptions(this.currentTeamCount);
          const sheets = ["A", "B", "C", "D", "E", "F"];

          draw.games.forEach((game, gIndex) => {
            drawsHtml += html`
              <div
                style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px;"
              >
                <select
                  name="draw_${this.currentDrawCount}_game_${gIndex}_sheet"
                >
                  ${sheets.map((s) => `<option value="${s}" ${s === game.sheet ? "selected" : ""}>Sheet ${s}</option>`).join("")}
                </select>
                <select
                  name="draw_${this.currentDrawCount}_game_${gIndex}_team_a"
                  class="team-select-node"
                  required
                >
                  ${teamOptions}
                </select>
                <span>vs</span>
                <select
                  name="draw_$this.urrentDrawCount}_game_${gIndex}_team_b"
                  class="team-select-node"
                  required
                >
                  ${teamOptions}
                </select>
              </div>
            `;
          });

          drawBlock.innerHTML = drawsHtml;
          this.drawsContainer.appendChild(drawBlock);

          // Reapply the specific dropdown index values once the HTML payload node exists!
          draw.games.forEach((game, gIndex) => {
            drawBlock.querySelector(
              `[name="draw_${this.currentDrawCount}_game_${gIndex}_team_a"]`,
            ).value = game.team_a;
            drawBlock.querySelector(
              `[name="draw_${this.currentDrawCount}_game_${gIndex}_team_b"]`,
            ).value = game.team_b;
          });
        });

        // 4. TRANSITION THE FORM HOOK FOR ACTION METHODS VIA HTMX
        form.setAttribute(
          "hx-put",
          "/functions/admin/submit-complete-syllabus",
        );
        form.removeAttribute("hx-post");
        htmx.process(form);

        submitBtn.textContent = "Save Schedule Revisions 💾";
        this.cancelBtn.style.display = "inline-block";
        this.scrollIntoView({ behavior: "smooth" });
      } catch (err) {
        console.error("Syllabus mapper extraction exception:", err);
      }
    }

