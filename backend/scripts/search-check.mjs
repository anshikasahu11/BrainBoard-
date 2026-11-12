// A self-test for global search. It builds two small workspaces, searches them as
// different people, and prints PASS or FAIL for each rule.
//
// Run it from the backend folder, with the backend already running:
//   node scripts/search-check.mjs

const API = process.env.API_URL || "http://localhost:5000";
const PASSWORD = "Password123";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

async function api(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, data };
}

async function login(email) {
  const { status, data } = await api("POST", "/api/auth/login", {
    body: { email, password: PASSWORD },
  });
  if (status !== 200) throw new Error(`Couldn't log in as ${email} (status ${status})`);
  return { token: data.token, id: data.user.id };
}

// A tiny document: one paragraph of text.
const text = (words) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: words }] }],
});

const titles = (group) => group.items.map((item) => item.title);
const keysOf = (item) => Object.keys(item).sort().join(",");

async function main() {
  console.log(`Checking global search at ${API}\n`);

  const anshika = await login("anshika@example.com");
  const rahul = await login("rahul@example.com");
  const priya = await login("priya@example.com");
  const token = anshika.token;

  const workspaceIds = [];

  try {
    const createWorkspace = async (name) => {
      const created = await api("POST", "/api/workspaces", { token, body: { name } });
      workspaceIds.push(created.data.workspace.id);
      return created.data.workspace.id;
    };

    const ws = await createWorkspace("Search Check");
    const other = await createWorkspace("Search Check Other");
    const base = `/api/workspaces/${ws}`;

    await api("POST", `${base}/members`, { token, body: { email: "rahul@example.com" } });

    // ----- Documents -----
    const makeDoc = async (title, words) => {
      const doc = (await api("POST", `${base}/documents`, { token, body: { title } })).data.document;
      if (words) {
        await api("PATCH", `${base}/documents/${doc.id}`, {
          token,
          body: { baseRevision: 0, content: text(words) },
        });
      }
      return doc;
    };

    await makeDoc("Roadmap notes", "Quarterly plan");
    await makeDoc("Launch roadmap", "Goals and milestones for the launch of BrainBoard");
    const meeting = await makeDoc("Meeting notes", "We discussed the roadmap and budget");
    await makeDoc("Budget", "Costs for the year");
    await makeDoc("Price (draft)", "Numbers to come");
    await makeDoc("C++ guide", "Use a.b*c for wildcards, and (parentheses) and [brackets]");
    await makeDoc("Wildcard trap", "aXbbbc is not the same thing");
    await makeDoc("Long one", `${"lorem ipsum ".repeat(200)}zebrafish${" dolor sit ".repeat(200)}`);

    await api("POST", `/api/workspaces/${other}/documents`, {
      token,
      body: { title: "Confidential plan" },
    });

    // ----- Tasks -----
    const makeTask = (title, description) =>
      api("POST", `${base}/tasks`, { token, body: { title, description } });

    await makeTask("Write roadmap docs", "Cover the quarterly roadmap");
    await makeTask("Fix login bug", "Users can't log in");
    await makeTask("Roadmap review", "Review with the team");
    await makeTask("Plan Q3", "Update the roadmap");

    // ----- Snippets -----
    const makeSnippet = (body) => api("POST", `${base}/snippets`, { token, body });

    await makeSnippet({
      title: "Verify token",
      code: "const ok = verifyToken(token);",
      language: "javascript",
      tags: ["auth", "jwt"],
    });
    await makeSnippet({
      title: "Roadmap query",
      description: "Fetch roadmap rows",
      code: "SELECT * FROM roadmap;",
      language: "sql",
      tags: ["sql"],
    });

    // `search("roadmap")` -> { status, data }
    const search = (q, extra = {}, who = token, workspace = ws) =>
      api("GET", `/api/workspaces/${workspace}/search?${new URLSearchParams({ q, ...extra })}`, {
        token: who,
      });

    // 1. Who may search?
    const outsider = await search("roadmap", {}, priya.token);
    check(
      "A non-member gets the same 'not found' as everywhere else",
      outsider.status === 404 && outsider.data?.message === "Workspace not found",
      JSON.stringify(outsider.data)
    );
    check(
      "Without a login, search is refused",
      (await api("GET", `${base}/search?q=roadmap`)).status === 401
    );

    // 2. Bad requests
    const missing = await api("GET", `${base}/search`, { token });
    check("A missing search is refused", missing.status === 400, String(missing.status));
    const tooShort = await search("a");
    check(
      "One character is refused, and the message says why",
      tooShort.status === 400 && /at least 2/.test(tooShort.data?.message ?? ""),
      JSON.stringify(tooShort.data)
    );
    check("A search of only spaces is refused", (await search("   ")).status === 400);
    check("An unknown type is refused", (await search("roadmap", { types: "documents,bogus" })).status === 400);
    check("An empty type list is refused", (await search("roadmap", { types: "," })).status === 400);

    // 3. The shape of the answer
    const roadmap = await search("roadmap");
    check("A good search returns 200", roadmap.status === 200, String(roadmap.status));
    const groups = roadmap.data.results;
    check(
      "All four groups are always present, each with items and hasMore",
      ["documents", "tasks", "snippets", "members"].every(
        (name) => Array.isArray(groups[name]?.items) && typeof groups[name]?.hasMore === "boolean"
      )
    );
    check("The search is echoed back", roadmap.data.query === "roadmap");

    // 4. Ranking
    check(
      "Documents: a title that starts with the search beats a word in a title, which beats body text",
      JSON.stringify(titles(groups.documents)) ===
        JSON.stringify(["Roadmap notes", "Launch roadmap", "Meeting notes"]),
      JSON.stringify(titles(groups.documents))
    );
    check(
      "Each result says which field matched",
      groups.documents.items[0].matchedIn === "title" && groups.documents.items[2].matchedIn === "text"
    );
    check(
      "A body match comes with an excerpt containing the match",
      groups.documents.items[2].excerpt.toLowerCase().includes("roadmap"),
      groups.documents.items[2].excerpt
    );
    check(
      "Tasks are ranked the same way: title start, title word, then description",
      JSON.stringify(titles(groups.tasks)) ===
        JSON.stringify(["Roadmap review", "Write roadmap docs", "Plan Q3"]),
      JSON.stringify(titles(groups.tasks))
    );
    check(
      "A task carries its status and priority",
      groups.tasks.items[0].status === "todo" && groups.tasks.items[0].priority === "medium"
    );
    check(
      "Snippets: the one named for the search comes first",
      titles(groups.snippets)[0] === "Roadmap query",
      JSON.stringify(titles(groups.snippets))
    );
    check("People: nobody is named roadmap", groups.members.items.length === 0);

    // 5. Where a match can be
    const code = await search("verifytoken");
    check(
      "A search finds text inside code, and says so",
      titles(code.data.results.snippets).includes("Verify token") &&
        code.data.results.snippets.items[0].matchedIn === "code" &&
        code.data.results.snippets.items[0].excerpt.includes("verifyToken"),
      JSON.stringify(code.data.results.snippets)
    );
    const tag = await search("jwt");
    check(
      "A search finds a tag, and says so",
      tag.data.results.snippets.items[0]?.title === "Verify token" &&
        tag.data.results.snippets.items[0].matchedIn === "tags"
    );
    const person = await search("rahul");
    check(
      "A person is found by name, with their email and role",
      person.data.results.members.items.length === 1 &&
        person.data.results.members.items[0].title === "Rahul" &&
        person.data.results.members.items[0].email === "rahul@example.com" &&
        person.data.results.members.items[0].role === "member",
      JSON.stringify(person.data.results.members)
    );
    const byEmail = await search("example.com");
    check(
      "A person is found by email",
      byEmail.data.results.members.items.length === 2 &&
        byEmail.data.results.members.items.every((item) => item.matchedIn === "email")
    );
    const deep = await search("zebrafish");
    check(
      "A match deep inside a long document gets a short excerpt around it",
      deep.data.results.documents.items[0]?.title === "Long one" &&
        deep.data.results.documents.items[0].excerpt.includes("zebrafish") &&
        deep.data.results.documents.items[0].excerpt.length <= 160,
      `${deep.data.results.documents.items[0]?.excerpt.length} characters`
    );

    // 5b. Case and spaces
    const shouting = await search("ROADMAP");
    check(
      "Case doesn't matter",
      JSON.stringify(titles(shouting.data.results.documents)) === JSON.stringify(titles(groups.documents))
    );
    const spaced = await search("  roadmap  ");
    check(
      "Extra spaces are ignored, and the cleaned search is echoed",
      spaced.data.query === "roadmap" &&
        JSON.stringify(titles(spaced.data.results.documents)) === JSON.stringify(titles(groups.documents))
    );
    const long = await search("a".repeat(150));
    check(
      "A very long search is shortened to 100 characters, not refused",
      long.status === 200 && long.data.query.length === 100,
      `${long.status}, ${long.data?.query?.length}`
    );

    // 6. Special characters mean nothing special
    const literal = await search("price (draft)");
    check(
      "Parentheses are searched for literally",
      literal.status === 200 && titles(literal.data.results.documents)[0] === "Price (draft)",
      JSON.stringify(literal.data?.results?.documents)
    );
    const wildcard = await search("a.b*c");
    check(
      "'.' and '*' are NOT wildcards",
      wildcard.status === 200 &&
        titles(wildcard.data.results.documents).includes("C++ guide") &&
        !titles(wildcard.data.results.documents).includes("Wildcard trap"),
      JSON.stringify(titles(wildcard.data.results.documents))
    );
    const broken = await search("([");
    check(
      "Characters that would break a pattern are harmless",
      broken.status === 200 && broken.data.results.documents.items.length === 0
    );
    const everything = await search(".*");
    check(
      "'.*' doesn't match everything",
      everything.status === 200 && everything.data.results.documents.items.length === 0
    );

    // 7. Other workspaces stay out of reach
    const secret = await search("confidential");
    check(
      "Something that exists only in another workspace is never returned",
      secret.status === 200 && secret.data.results.documents.items.length === 0
    );
    const inOther = await search("confidential", {}, token, other);
    check(
      "...but it is found in the workspace it belongs to",
      titles(inOther.data.results.documents)[0] === "Confidential plan"
    );

    // 8. Types and limits
    const onlyTasks = await search("roadmap", { types: "tasks" });
    check(
      "types=tasks searches only tasks",
      onlyTasks.data.results.tasks.items.length === 3 &&
        onlyTasks.data.results.documents.items.length === 0 &&
        onlyTasks.data.results.snippets.items.length === 0
    );
    const two = await search("roadmap", { types: "tasks,snippets" });
    check(
      "Several types can be combined",
      two.data.results.tasks.items.length === 3 &&
        two.data.results.snippets.items.length === 1 &&
        two.data.results.documents.items.length === 0
    );
    const one = await search("roadmap", { limit: 1 });
    check(
      "limit=1 keeps one result per group, and hasMore says there's more",
      one.data.results.documents.items.length === 1 &&
        one.data.results.documents.hasMore === true &&
        one.data.results.documents.items[0].title === "Roadmap notes" &&
        one.data.results.members.hasMore === false
    );
    const huge = await search("roadmap", { limit: 999 });
    check("A huge limit is quietly capped, not refused", huge.status === 200);

    // 9. What a result may contain
    check(
      "A document result has only these fields",
      keysOf(groups.documents.items[0]) === "excerpt,id,matchedIn,title,updatedAt",
      keysOf(groups.documents.items[0])
    );
    check(
      "A task result has only these fields",
      keysOf(groups.tasks.items[0]) === "excerpt,id,matchedIn,priority,status,title,updatedAt",
      keysOf(groups.tasks.items[0])
    );
    check(
      "A snippet result has only these fields (never the full code)",
      keysOf(groups.snippets.items[0]) === "excerpt,id,language,matchedIn,tags,title,updatedAt",
      keysOf(groups.snippets.items[0])
    );
    check(
      "A person result has only these fields",
      keysOf(person.data.results.members.items[0]) === "email,id,matchedIn,role,title",
      keysOf(person.data.results.members.items[0])
    );

    // 10. Everyone in the workspace sees the same results
    const asRahul = await search("roadmap", {}, rahul.token);
    check(
      "A plain member sees the same results",
      asRahul.status === 200 &&
        JSON.stringify(titles(asRahul.data.results.documents)) === JSON.stringify(titles(groups.documents))
    );

    // 11. Changes show up straight away
    await api("DELETE", `${base}/documents/${meeting.id}`, { token });
    const afterDelete = await search("roadmap");
    check(
      "A deleted document is no longer found",
      !titles(afterDelete.data.results.documents).includes("Meeting notes")
    );

    const notes = groups.documents.items[0];
    await api("PATCH", `${base}/documents/${notes.id}`, {
      token,
      body: { baseRevision: 1, title: "Planning notes" },
    });
    const afterRename = await search("roadmap");
    const byNewName = await search("planning");
    check(
      "A renamed document is found under its new name, not the old one",
      !titles(afterRename.data.results.documents).includes("Roadmap notes") &&
        titles(byNewName.data.results.documents).includes("Planning notes"),
      JSON.stringify(titles(afterRename.data.results.documents))
    );

    // 12. Removed people lose search
    await api("DELETE", `${base}/members/${rahul.id}`, { token });
    check(
      "A removed member can no longer search the workspace",
      (await search("roadmap", {}, rahul.token)).status === 404
    );
  } finally {
    for (const id of workspaceIds) await api("DELETE", `/api/workspaces/${id}`, { token: anshika.token });
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nThe check couldn't finish: ${error.message}`);
  process.exit(1);
});