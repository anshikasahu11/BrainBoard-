// Creates a demo workspace full of varied activity, so you can see the Activity page with
// real data. Anshika owns it and Rahul is a member. It prints a link when it's done.
//
// Run it from the backend folder, with the backend already running:
//   node scripts/activity-demo.mjs
//
// Delete the workspace afterwards in its Settings (Danger zone), if you like.

const API = process.env.API_URL || "http://localhost:5000";
const WEB = process.env.WEB_URL || "http://localhost:3000";
const PASSWORD = "Password123";

async function api(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${data?.message ?? "no message"}`);
  }
  return data;
}

async function login(email) {
  const data = await api("POST", "/api/auth/login", { body: { email, password: PASSWORD } });
  return { token: data.token, id: data.user.id };
}

const text = (words) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: words }] }],
});

async function main() {
  console.log(`Building a demo workspace at ${API}\n`);

  const anshika = await login("anshika@example.com");
  const rahul = await login("rahul@example.com");
  const a = anshika.token;
  const r = rahul.token;

  const { workspace } = await api("POST", "/api/workspaces", { token: a, body: { name: "Activity Demo" } });
  const base = `/api/workspaces/${workspace.id}`;
  await api("POST", `${base}/members`, { token: a, body: { email: "rahul@example.com" } });

  // A document, edited by both of them.
  const doc = (await api("POST", `${base}/documents`, { token: a, body: { title: "Launch plan" } })).document;
  const docUrl = `${base}/documents/${doc.id}`;
  let revision = 0;
  const saveDoc = async (token, body) => {
    const saved = await api("PATCH", docUrl, { token, body: { baseRevision: revision, ...body } });
    revision = saved.document.revision;
  };

  await saveDoc(a, { content: text("Goals for the launch") });
  await saveDoc(a, { title: "Launch roadmap" });
  const named = (await api("POST", `${docUrl}/versions`, { token: a, body: { label: "Release candidate" } })).version;
  await saveDoc(r, { content: text("Goals and milestones for the launch") });
  await api("POST", `${docUrl}/versions/${named.number}/restore`, { token: a, body: { baseRevision: revision } });

  // Tasks.
  const tasks = `${base}/tasks`;
  const login_ = (await api("POST", tasks, { token: a, body: { title: "Login API" } })).task;
  const docs_ = (await api("POST", tasks, { token: a, body: { title: "Write docs" } })).task;
  for (let i = 1; i <= 20; i += 1) {
    await api("POST", tasks, { token: a, body: { title: `Backlog item ${i}` } });
  }
  await api("PATCH", `${tasks}/${login_.id}/move`, { token: r, body: { status: "in_progress", afterId: null } });
  await api("PATCH", `${tasks}/${login_.id}/move`, { token: r, body: { status: "review", afterId: null } });
  await api("PATCH", `${tasks}/${login_.id}`, { token: a, body: { assignee: rahul.id } });
  await api("PATCH", `${tasks}/${login_.id}`, { token: a, body: { assignee: null } });
  await api("PATCH", `${tasks}/${docs_.id}`, { token: a, body: { priority: "high" } });
  await api("DELETE", `${tasks}/${docs_.id}`, { token: a });

  // Snippets.
  const snippets = `${base}/snippets`;
  const verify = (
    await api("POST", snippets, {
      token: a,
      body: { title: "Verify a token", code: "const ok = verify(token);", language: "javascript" },
    })
  ).snippet;
  const scratch = (
    await api("POST", snippets, { token: r, body: { title: "Scratch", code: "select 1;", language: "sql" } })
  ).snippet;
  await api("PATCH", `${snippets}/${verify.id}`, { token: a, body: { baseRevision: 0, title: "Verify a JWT" } });
  await api("DELETE", `${snippets}/${scratch.id}`, { token: a });

  // People and the workspace.
  await api("PATCH", `${base}/members/${rahul.id}`, { token: a, body: { role: "admin" } });
  await api("PATCH", `${base}/members/${rahul.id}`, { token: a, body: { role: "member" } });
  await api("PATCH", base, { token: a, body: { name: "Activity Demo (team)" } });

  const feed = await api("GET", `${base}/activity?limit=100`, { token: a });

  console.log(`Done: ${feed.activities.length} entries.\n`);
  console.log("Sign in as anshika@example.com and open:");
  console.log(`  ${WEB}/workspaces/${workspace.id}/activity\n`);
  console.log("(To tidy up later: open that workspace's Settings and use Delete workspace.)");
}

main().catch((error) => {
  console.error(`\nThe demo couldn't finish: ${error.message}`);
  process.exit(1);
});