/* REST — Area 2 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "rest",
    title: "REST",
    tagline: "Model your API as resources (nouns) acted on by standard HTTP verbs.",
    diagramNote: "Resources are URLs; HTTP methods are the operations; status codes report the outcome.",
    gameNote: "Build HTTP requests against a mock /users API. Match the right verb + path to each task and watch the resource state change.",

    explanation: `
      <p><strong>REST</strong> (REpresentational State Transfer) is an architectural style for APIs built on a simple idea: model everything as <strong>resources</strong> (nouns), each addressable by a URL, and act on them with the standard <strong>HTTP verbs</strong>.</p>
      <h3>Resources + verbs</h3>
      <ul>
        <li><code>GET /users</code> — list users &nbsp; · &nbsp; <code>GET /users/42</code> — read user 42</li>
        <li><code>POST /users</code> — create a new user</li>
        <li><code>PUT /users/42</code> — replace user 42 &nbsp; · &nbsp; <code>PATCH /users/42</code> — partially update</li>
        <li><code>DELETE /users/42</code> — remove user 42</li>
      </ul>
      <p>The URL names <em>what</em> (the resource); the method says <em>how</em> you want to act on it. You never put verbs in the path (<code>/getUser</code>, <code>/deleteUser</code> are anti-patterns) — the HTTP method already is the verb.</p>
      <h3>Key properties</h3>
      <ul>
        <li><strong>Stateless</strong> — each request carries all context; the server keeps no per-client session between calls, which makes servers easy to scale horizontally.</li>
        <li><strong>Uniform interface</strong> — the same handful of verbs and status codes work across every resource, so clients are predictable.</li>
        <li><strong>Safe & idempotent methods</strong> — <code>GET</code> changes nothing; <code>PUT</code> and <code>DELETE</code> can be repeated with the same effect; <code>POST</code> is neither, which is why creating twice makes two resources.</li>
      </ul>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Where REST strains</h5><p>REST shines for CRUD-style resource APIs. It gets awkward for operations that aren't naturally a noun (e.g. "transfer money"), for fetching deeply nested data in one call (over/under-fetching — the problem GraphQL targets), and for low-latency internal calls (where gRPC wins).</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 260,
        nodes: [
          { id: "client", x: 40, y: 100, w: 110, h: 50, label: "Client", kind: "accent" },
          { id: "api", x: 300, y: 100, w: 150, h: 50, label: "/users API", kind: "good", glow: true },
          { id: "db", x: 580, y: 100, w: 120, h: 50, label: "Database", kind: "purple" },
        ],
        links: [
          { from: "client", to: "api", accent: true, label: "GET/POST/..." },
          { from: "api", to: "db", label: "query" },
        ],
        labels: [
          { x: 375, y: 60, text: "GET /users/42  →  200 {user}", color: "#3ddc84", size: 12, align: "middle" },
          { x: 375, y: 210, text: "DELETE /users/42  →  204 No Content", color: "#ff6b6b", size: 12, align: "middle" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Complete each task by choosing the correct HTTP verb and path. Correct REST design makes the right call obvious. Watch the resource collection update live.",
        help: "Pick a verb, type/confirm the path and body, then Send. The task tells you what to accomplish.",
      });

      // DOM-based interactive (forms are clearer than canvas here)
      const panel = document.createElement("div");
      refs.canvas.parentElement.style.display = "none"; // hide canvas, use DOM

      const state = { users: [{ id: 1, name: "Ada" }, { id: 2, name: "Linus" }], nextId: 3 };
      const tasks = [
        { desc: "List all users", verb: "GET", path: "/users", body: "" },
        { desc: "Read the user with id 1", verb: "GET", path: "/users/1", body: "" },
        { desc: "Create a user named 'Grace'", verb: "POST", path: "/users", body: '{"name":"Grace"}' },
        { desc: "Rename user 2 to 'Linus T.'", verb: "PATCH", path: "/users/2", body: '{"name":"Linus T."}' },
        { desc: "Delete user 1", verb: "DELETE", path: "/users/1", body: "" },
      ];
      let taskIdx = 0, score = 0;

      panel.innerHTML = `
        <div id="restTask" style="padding:14px 16px;border-radius:10px;background:rgba(110,168,254,0.08);border:1px solid var(--border-strong);margin-bottom:14px;font-size:15px"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <select id="restVerb" class="gbtn" style="padding:9px">
            <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
          </select>
          <input id="restPath" class="gbtn" style="flex:1;min-width:160px;font-family:var(--mono)" placeholder="/users or /users/1" />
          <input id="restBody" class="gbtn" style="flex:1;min-width:160px;font-family:var(--mono)" placeholder='body e.g. {"name":"Grace"}' />
          <button id="restSend" class="gbtn primary">Send ▶</button>
        </div>
        <div id="restResp" style="font-family:var(--mono);font-size:13px;background:#0a0e1a;border:1px solid var(--border);border-radius:10px;padding:14px;min-height:70px;white-space:pre-wrap;color:#c9d2e6"></div>
        <div style="margin-top:14px"><strong style="font-size:13px;color:var(--dim)">RESOURCE STATE — /users</strong><div id="restState" style="font-family:var(--mono);font-size:13px;margin-top:6px;color:#9ec3ff"></div></div>
      `;
      refs.shell.appendChild(panel);

      const stScore = SDE.stat(refs.stats, "Correct", "good");
      const stTask = SDE.stat(refs.stats, "Task");

      const taskEl = panel.querySelector("#restTask");
      const verbEl = panel.querySelector("#restVerb");
      const pathEl = panel.querySelector("#restPath");
      const bodyEl = panel.querySelector("#restBody");
      const respEl = panel.querySelector("#restResp");
      const stateEl = panel.querySelector("#restState");

      function renderState() { stateEl.textContent = JSON.stringify(state.users); }
      function showTask() {
        if (taskIdx >= tasks.length) { taskEl.innerHTML = "🎉 <strong>All tasks complete!</strong> You've used every REST verb correctly."; return; }
        taskEl.innerHTML = "📋 <strong>Task " + (taskIdx + 1) + ":</strong> " + tasks[taskIdx].desc;
        stTask((taskIdx + 1) + "/" + tasks.length);
      }

      function handle(verb, path, body) {
        const mId = path.match(/^\/users\/(\d+)$/);
        const isColl = path === "/users";
        let parsed = null;
        if (body) { try { parsed = JSON.parse(body); } catch { return { code: 400, msg: "400 Bad Request — invalid JSON body" }; } }
        if (verb === "GET" && isColl) return { code: 200, msg: "200 OK\n" + JSON.stringify(state.users, null, 2) };
        if (verb === "GET" && mId) { const u = state.users.find(x => x.id == mId[1]); return u ? { code: 200, msg: "200 OK\n" + JSON.stringify(u) } : { code: 404, msg: "404 Not Found" }; }
        if (verb === "POST" && isColl) { if (!parsed || !parsed.name) return { code: 400, msg: "400 Bad Request — need {name}" }; const u = { id: state.nextId++, name: parsed.name }; state.users.push(u); return { code: 201, msg: "201 Created\n" + JSON.stringify(u) }; }
        if ((verb === "PATCH" || verb === "PUT") && mId) { const u = state.users.find(x => x.id == mId[1]); if (!u) return { code: 404, msg: "404 Not Found" }; if (parsed && parsed.name) u.name = parsed.name; return { code: 200, msg: "200 OK\n" + JSON.stringify(u) }; }
        if (verb === "DELETE" && mId) { const i = state.users.findIndex(x => x.id == mId[1]); if (i < 0) return { code: 404, msg: "404 Not Found" }; state.users.splice(i, 1); return { code: 204, msg: "204 No Content" }; }
        return { code: 405, msg: "405 Method Not Allowed for this path" };
      }

      panel.querySelector("#restSend").addEventListener("click", () => {
        const verb = verbEl.value, path = pathEl.value.trim(), body = bodyEl.value.trim();
        if (!path) { respEl.textContent = "Enter a path first."; return; }
        const res = handle(verb, path, body);
        respEl.textContent = res.msg;
        respEl.style.color = res.code < 300 ? "#8fe3b0" : res.code < 500 ? "#ffd98a" : "#ff9a9a";
        renderState();
        // check task match
        const t = tasks[taskIdx];
        if (t && verb === t.verb && path === t.path) {
          score++; stScore(score);
          SDE.toast("Correct REST call! " + verb + " " + path, "✅");
          taskIdx++; showTask();
          verbEl.value = tasks[taskIdx] ? "GET" : verbEl.value; pathEl.value = ""; bodyEl.value = "";
        } else if (t) {
          SDE.toast("That worked, but the task wanted a different call. Try again.", "🤔");
        }
      });

      showTask(); renderState(); stScore(0);
      return { destroy() {} };
    },
  });
})(window);
