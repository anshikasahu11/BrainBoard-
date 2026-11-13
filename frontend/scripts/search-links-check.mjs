// A self-test for exact search links and recent searches. It needs no servers.
//
// Run it from the frontend folder:
//   node scripts/search-links-check.mjs
//
// (Node may print a yellow warning about a "module type". That's harmless.)

import { deepLinkHref, resultHref } from "../lib/searchResults.js";
import {
  MAX_RECENT,
  addRecent,
  clearAllRecentSearches,
  clearRecentSearches,
  loadRecent,
  normalizeQuery,
  parseStored,
  removeRecent,
  removeRecentSearch,
  saveRecentSearch,
} from "../lib/recentSearches.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A stand-in for the browser's storage.
class FakeStorage {
  constructor() {
    this.map = new Map();
  }
  get length() {
    return this.map.size;
  }
  key(index) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

// Storage that fails every time (private browsing, a full disk...).
const broken = {
  get length() {
    throw new Error("blocked");
  },
  key() {
    throw new Error("blocked");
  },
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
  removeItem() {
    throw new Error("blocked");
  },
};

console.log("Checking exact links and recent searches\n");

// 1. Exact links
check(
  "A task opens that task on the board, through the address",
  deepLinkHref("task", { id: "t1" }, "w1") === "/workspaces/w1/tasks?task=t1"
);
check(
  "A snippet opens that snippet",
  deepLinkHref("snippet", { id: "s1" }, "w1") === "/workspaces/w1/snippets?snippet=s1"
);
check(
  "A document opens its own page, and a person opens the Members page",
  deepLinkHref("document", { id: "d1" }, "w1") === "/workspaces/w1/documents/d1" &&
    deepLinkHref("member", { id: "m1" }, "w1") === "/workspaces/w1/members"
);
check(
  "Ids are made safe for an address",
  deepLinkHref("task", { id: "a b/c?x=1" }, "w1") === "/workspaces/w1/tasks?task=a%20b%2Fc%3Fx%3D1"
);
check(
  "With no id, a link falls back to the page",
  deepLinkHref("task", undefined, "w1") === "/workspaces/w1/tasks" &&
    deepLinkHref("snippet", {}, "w1") === "/workspaces/w1/snippets" &&
    deepLinkHref("document", {}, "w1") === "/workspaces/w1/documents"
);
check("An unknown kind falls back to the dashboard", deepLinkHref("robot", { id: "x" }, "w1") === "/workspaces/w1");
check(
  "The page-level link is unchanged",
  resultHref("task", { id: "t1" }, "w1") === "/workspaces/w1/tasks" &&
    resultHref("snippet", { id: "s1" }, "w1") === "/workspaces/w1/snippets"
);

// 2. Cleaning a search
check("Extra spaces are squashed and the ends trimmed", normalizeQuery("  a   b  ") === "a b");
check("Nothing in gives an empty search", normalizeQuery(null) === "" && normalizeQuery(undefined) === "");
check("A long search is cut to 100 characters", normalizeQuery("x".repeat(150)).length === 100);

// 3. The list
check("A new search goes to the front", same(addRecent(["roadmap"], "launch"), ["launch", "roadmap"]));
check(
  "The same search with other capitals replaces the old one",
  same(addRecent(["launch", "roadmap"], "ROADMAP"), ["ROADMAP", "launch"])
);
check("A search is cleaned before it's added", same(addRecent([], "  Verify   Token "), ["Verify Token"]));
check(
  "A search too short to run is ignored, and the very same list comes back",
  (() => {
    const list = ["roadmap"];
    return addRecent(list, "a") === list && addRecent(list, "") === list && addRecent(list, "   ") === list;
  })()
);
check(
  "The list keeps only the newest 8",
  (() => {
    let list = [];
    for (let i = 1; i <= 12; i += 1) list = addRecent(list, `search ${i}`);
    return list.length === MAX_RECENT && list[0] === "search 12" && list.at(-1) === "search 5";
  })()
);
check(
  "Adding never changes the list it was given",
  (() => {
    const list = ["roadmap"];
    addRecent(list, "launch");
    return same(list, ["roadmap"]);
  })()
);
check("A search can be removed (capitals ignored)", same(removeRecent(["Launch", "roadmap"], "LAUNCH"), ["roadmap"]));

// 4. Reading back whatever was stored
check("A stored list is read back", same(parseStored('["launch","roadmap"]'), ["launch", "roadmap"]));
check("Nothing stored gives an empty list", same(parseStored(null), []));
check("Damaged data gives an empty list", same(parseStored("not json"), []) && same(parseStored("{"), []));
check("Something that isn't a list gives an empty list", same(parseStored('{"a":1}'), []) && same(parseStored('"text"'), []) && same(parseStored("42"), []));
check(
  "Odd entries are dropped and the rest kept",
  same(parseStored('["launch", 5, null, {"x":1}, "a", "", "  ", "roadmap"]'), ["launch", "roadmap"])
);
check(
  "Repeats are dropped (the newest spelling wins), and spaces are tidied",
  same(parseStored('["Launch","launch","  road   map "]'), ["Launch", "road map"])
);
check(
  "A stored list that's too long is cut to 8",
  parseStored(JSON.stringify(Array.from({ length: 30 }, (_, i) => `entry ${i}`))).length === MAX_RECENT
);

// 5. The browser's storage
const storage = new FakeStorage();
check("A person with nothing saved has no recent searches", same(loadRecent("u1", "w1", storage), []));

saveRecentSearch("u1", "w1", "roadmap", storage);
saveRecentSearch("u1", "w1", "launch", storage);
check("Saved searches are read back, newest first", same(loadRecent("u1", "w1", storage), ["launch", "roadmap"]));

saveRecentSearch("u1", "w1", "ROADMAP", storage);
check("Saving a repeat moves it to the front", same(loadRecent("u1", "w1", storage), ["ROADMAP", "launch"]));

check(
  "Another person doesn't see them",
  same(loadRecent("u2", "w1", storage), [])
);
check("Another workspace doesn't see them", same(loadRecent("u1", "w2", storage), []));

saveRecentSearch("u2", "w1", "budget", storage);
saveRecentSearch("u1", "w2", "tasks", storage);
removeRecentSearch("u1", "w1", "launch", storage);
check("One search can be removed", same(loadRecent("u1", "w1", storage), ["ROADMAP"]));

storage.setItem("some-other-app:key", "keep me");
clearRecentSearches("u1", "w1", storage);
check(
  "Clearing one workspace's searches leaves everyone else's alone",
  same(loadRecent("u1", "w1", storage), []) &&
    same(loadRecent("u2", "w1", storage), ["budget"]) &&
    same(loadRecent("u1", "w2", storage), ["tasks"])
);

clearAllRecentSearches(storage);
check(
  "Logging out forgets every search, and leaves other things in storage alone",
  same(loadRecent("u2", "w1", storage), []) &&
    same(loadRecent("u1", "w2", storage), []) &&
    storage.getItem("some-other-app:key") === "keep me" &&
    storage.length === 1
);

const spoiled = new FakeStorage();
saveRecentSearch("u1", "w1", "roadmap", spoiled);
spoiled.setItem(spoiled.key(0), "this is not json");
check("Damaged stored data reads as no searches, and can be saved over", same(loadRecent("u1", "w1", spoiled), []) && same(saveRecentSearch("u1", "w1", "launch", spoiled), ["launch"]));

const noIds = new FakeStorage();
check(
  "Without a person or workspace nothing is read or written",
  same(loadRecent("", "w1", noIds), []) &&
    same(saveRecentSearch(undefined, "w1", "roadmap", noIds), ["roadmap"]) &&
    noIds.length === 0
);

check(
  "Storage that always fails never crashes anything",
  (() => {
    try {
      return (
        same(loadRecent("u1", "w1", broken), []) &&
        same(saveRecentSearch("u1", "w1", "roadmap", broken), ["roadmap"]) &&
        same(removeRecentSearch("u1", "w1", "roadmap", broken), []) &&
        clearRecentSearches("u1", "w1", broken) === undefined &&
        clearAllRecentSearches(broken) === undefined
      );
    } catch {
      return false;
    }
  })()
);
check(
  "Missing storage never crashes anything",
  same(loadRecent("u1", "w1", null), []) &&
    same(saveRecentSearch("u1", "w1", "roadmap", null), ["roadmap"]) &&
    clearAllRecentSearches(null) === undefined
);

// 6. A property test: random searches, in any order
let seed = 4242;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pool = ["road", "Road", "ROAD ", " map", "login", "x", "", "  ", "verify token", "Verify  Token", "(draft)", "a.b*c", "launch", "budget", "notes", "plan", "api docs"];

let list = [];
let allGood = true;
let firstBad = "";
for (let run = 0; run < 400; run += 1) {
  const query = pool[Math.floor(random() * pool.length)];
  const before = list;
  list = addRecent(list, query);

  const clean = normalizeQuery(query);
  const valid = clean.length >= 2;
  const lowered = list.map((entry) => entry.toLowerCase());

  const good =
    list.length <= MAX_RECENT &&
    new Set(lowered).size === list.length &&
    (!valid || list[0] === clean) &&
    (valid || list === before);

  if (!good && allGood) {
    allGood = false;
    firstBad = JSON.stringify({ query, list });
  }
}
check(
  "400 random searches: never more than 8, never a repeat, the newest valid one is always first",
  allGood,
  firstBad
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);