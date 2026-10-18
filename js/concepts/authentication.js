/* Authentication — Area 4 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "authentication",
    title: "Authentication",
    tagline: "Proving who you are — turning credentials into a trusted, verifiable identity.",
    diagramNote: "Credentials are exchanged once for a signed token; later requests present the token.",
    gameNote: "Walk a login through credential check → token issue → token verification. Try tampering with the token and watch the signature catch it.",

    explanation: `
      <p><strong>Authentication</strong> (authN) answers "<em>who are you?</em>" — it verifies identity. (Don't confuse it with authorization, which answers "<em>what are you allowed to do?</em>" — that's next.)</p>
      <h3>The flow</h3>
      <ol>
        <li>The user presents <strong>credentials</strong> (username + password, or a passkey, or an OAuth login with Google).</li>
        <li>The server verifies them — e.g. hashing the password and comparing to the stored hash (never store plaintext passwords; use bcrypt/argon2 with a salt).</li>
        <li>On success the server issues a <strong>token</strong> or <strong>session</strong> that proves "this request comes from an authenticated user," so the user doesn't resend their password on every call.</li>
      </ol>
      <h3>Tokens: how later requests stay trusted</h3>
      <p>A common choice is a <strong>JWT</strong> (JSON Web Token): a signed blob containing claims (user id, expiry). The server signs it with a secret key. On each request the client sends the token; the server verifies the <strong>signature</strong> to confirm it issued the token and that it hasn't been tampered with — without any database lookup. If someone edits a single character of the payload, the signature no longer matches and the token is rejected.</p>
      <div class="callout tip"><span class="c-ico">🔑</span><div><h5>Stronger authentication</h5><p><strong>MFA</strong> (multi-factor) combines something you know (password), have (phone/token), or are (biometric), so a stolen password alone isn't enough. <strong>OAuth/OIDC</strong> lets users log in via a trusted provider so your app never handles their password at all.</p></div></div>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Tokens vs sessions</h5><p>Signed tokens are stateless (no server storage, great for scale) but hard to revoke before they expire. Server sessions are revocable instantly but require shared session storage. See the Sessions concept for this trade-off in depth.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 240,
        nodes: [
          { id: "u", x: 40, y: 95, w: 120, h: 50, label: "User", kind: "client" },
          { id: "auth", x: 300, y: 90, w: 150, h: 60, label: "Auth Server", kind: "good", glow: true },
          { id: "api", x: 580, y: 95, w: 120, h: 50, label: "API", kind: "accent" },
        ],
        links: [
          { from: "u", to: "auth", accent: true, label: "1. credentials" },
          { from: "auth", to: "u", color: "#3ddc84", label: "2. signed token" },
          { from: "u", to: "api", color: "#6ea8fe", label: "3. token →", dashed: true },
        ],
        labels: [{ x: 640, y: 170, text: "API verifies signature", color: "#6ea8fe", size: 11, align: "middle" }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Understand signed tokens. Log in to get a token, then send it to the API. Try the 'Tamper' button to edit the token — the signature check will reject it, proving tokens can't be forged without the secret.",
        help: "Follow the steps 1→2→3. Then tamper and re-verify to see the signature catch the forgery.",
      });
      refs.canvas.parentElement.style.display = "none";
      const panel = document.createElement("div");
      refs.shell.appendChild(panel);

      let token = null, verified = null;
      function fakeSign(payload) {
        // toy signature: sum of char codes mod 9973 — deterministic, tamper-sensitive
        let h = 0; for (const ch of payload) h = (h * 31 + ch.charCodeAt(0)) % 99991; return h.toString(16);
      }
      function makeToken(user) {
        const payload = JSON.stringify({ sub: user, role: "user", exp: "2026-01-01" });
        return { payload, sig: fakeSign(payload) };
      }

      const stStep = SDE.stat(refs.stats, "Status");
      const stVerify = SDE.stat(refs.stats, "Verification");

      function render() {
        panel.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="kv-card">
              <h5>1 · Login</h5>
              <input id="aUser" class="gbtn" style="width:100%;margin:6px 0;font-family:var(--mono)" value="ada" />
              <input id="aPass" class="gbtn" type="password" style="width:100%;margin:6px 0;font-family:var(--mono)" value="hunter2" />
              <button id="aLogin" class="gbtn primary" style="width:100%">Authenticate →</button>
            </div>
            <div class="kv-card">
              <h5>2 · Issued token (JWT-style)</h5>
              <div id="aToken" style="font-family:var(--mono);font-size:12px;color:#9ec3ff;word-break:break-all;min-height:60px">— not logged in —</div>
              <button id="aTamper" class="gbtn" style="margin-top:8px" disabled>😈 Tamper (set role=admin)</button>
            </div>
          </div>
          <div class="kv-card" style="margin-top:16px">
            <h5>3 · API verifies the token</h5>
            <button id="aVerify" class="gbtn primary" disabled>Send token to API</button>
            <div id="aResult" style="font-family:var(--mono);font-size:13px;margin-top:10px;min-height:24px"></div>
          </div>`;
        panel.querySelector("#aLogin").onclick = () => {
          const u = panel.querySelector("#aUser").value, p = panel.querySelector("#aPass").value;
          if (p !== "hunter2") { stStep("bad password"); SDE.toast("Invalid credentials ✗", "🚫"); return; }
          token = makeToken(u); verified = null;
          stStep("authenticated ✓"); SDE.toast("Credentials verified — token issued", "🔑");
          showToken();
          panel.querySelector("#aTamper").disabled = false;
          panel.querySelector("#aVerify").disabled = false;
        };
        panel.querySelector("#aTamper").onclick = () => {
          if (!token) return;
          token.payload = token.payload.replace('"role":"user"', '"role":"admin"'); // signature NOT updated
          showToken(); SDE.toast("Payload edited — but signature was NOT re-signed", "😈");
        };
        panel.querySelector("#aVerify").onclick = () => {
          const expected = fakeSign(token.payload);
          const ok = expected === token.sig;
          verified = ok;
          const r = panel.querySelector("#aResult");
          r.innerHTML = ok ? '<span style="color:#8fe3b0">✓ 200 OK — signature valid, identity trusted: ' + JSON.parse(token.payload).sub + ' (role ' + JSON.parse(token.payload).role + ')</span>'
            : '<span style="color:#ff9a9a">✗ 401 Unauthorized — signature mismatch! Token was tampered with and is rejected.</span>';
          stVerify(ok ? "valid ✓" : "REJECTED ✗");
          SDE.toast(ok ? "Token verified" : "Forgery detected!", ok ? "✅" : "🛑");
        };
        showToken();
      }
      function showToken() {
        const el = panel.querySelector("#aToken");
        if (!el) return;
        if (!token) { el.textContent = "— not logged in —"; return; }
        el.innerHTML = '<span style="color:#8fb6ff">' + btoa(token.payload).slice(0, 40) + '…</span>.<span style="color:#ffca3a">' + token.sig + '</span>';
      }
      render(); stStep("—"); stVerify("—");
      return { destroy() {} };
    },
  });
})(window);
