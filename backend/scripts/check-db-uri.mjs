// Checks a database address (MONGODB_URI) for the usual mistakes, then tries it from this computer.
// It NEVER prints the password. It prints the username, the host and the database name (not secret),
// the password's LENGTH, and what is wrong, if anything.
//
// In PowerShell, from the backend folder. Copy the address from Notepad first (Ctrl + A, Ctrl + C):
//   $env:CHECK_URI = Get-Clipboard -Raw
//   node scripts/check-db-uri.mjs
//   Remove-Item Env:CHECK_URI
//   Set-Clipboard -Value " "

import { pathToFileURL } from "node:url";

// What can be said about text that isn't an address, without revealing it.
export function describeText(raw) {
  const text = String(raw ?? "").trim();
  const lines = text === "" ? 0 : text.split(/\r?\n/).length;
  const notes = [];

  if (text.length === 0) {
    notes.push("nothing was received at all. The clipboard was empty, or the copy didn't work. Go back to Notepad, press Ctrl + A then Ctrl + C, and run the commands again");
  } else if (text.length < 25) {
    notes.push(`only ${text.length} ${text.length === 1 ? "character was" : "characters were"} received, far too short for a database address (they are usually 100 or more). The copy or paste probably didn't carry the whole address`);
  } else if (lines > 1) {
    notes.push(`${lines} lines were received. An address is ONE line, so more than the address was copied. Select only the address`);
  } else if (!text.includes("://")) {
    notes.push(`${text.length} characters were received, but without "://" in them, so it isn't an address. Is it only a password or a username?`);
  } else {
    notes.push(`${text.length} characters were received, but it doesn't start with mongodb+srv://`);
  }

  return { length: text.length, lines, notes };
}

// Takes the address apart and lists what's wrong with it. Pure: no network.
export function analyzeUri(raw) {
  const problems = [];
  const notes = [];
  const original = String(raw ?? "");

  if (original !== original.trim()) notes.push("there is a space or line break at the start or end (ignored for this test, but make sure the value saved in Render has none)");
  let uri = original.trim();

  if (/^["'].*["']$/s.test(uri)) {
    problems.push("the address is wrapped in quote marks, which must not be part of it");
    uri = uri.slice(1, -1).trim();
  }

  // "MONGODB_URI=mongodb+srv://..." is a line from a settings file, not an address.
  const named = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/s.exec(uri);
  if (named && /^["']?mongodb(\+srv)?:\/\//i.test(named[2].trim())) {
    problems.push(`the text starts with "${named[1]}=", which is the setting's NAME, not part of the address. Paste only what comes after the = sign`);
    uri = named[2].trim();
    if (/^["'].*["']$/s.test(uri)) {
      problems.push("the address is wrapped in quote marks, which must not be part of it");
      uri = uri.slice(1, -1).trim();
    }
  }

  if (/[<>]/.test(uri)) problems.push("the address still contains < or >, which means a placeholder like <db_password> was left in. Remove the brackets and write the real value");
  if (/\s/.test(uri)) problems.push("the address contains a space or line break in the middle");

  const scheme = /^(mongodb\+srv|mongodb):\/\//.exec(uri)?.[1] ?? null;
  if (!scheme) {
    if (/^mongodb(\+srv)?:\/\//i.test(uri)) problems.push("the start must be lowercase: mongodb+srv://");
    else problems.push("the address must start with mongodb+srv:// (or mongodb://)");
    return { ok: false, problems, notes, scheme: null, seen: describeText(raw) };
  }

  const afterScheme = uri.slice(scheme.length + 3);
  const queryStart = afterScheme.indexOf("?");
  const beforeQuery = queryStart === -1 ? afterScheme : afterScheme.slice(0, queryStart);
  const lastAt = beforeQuery.lastIndexOf("@");

  if (lastAt === -1) {
    problems.push("the address has no username and password (no @ found)");
    return { ok: false, problems, notes, scheme };
  }

  const userInfo = beforeQuery.slice(0, lastAt);
  const rest = beforeQuery.slice(lastAt + 1);
  const colon = userInfo.indexOf(":");
  const username = colon === -1 ? userInfo : userInfo.slice(0, colon);
  const password = colon === -1 ? "" : userInfo.slice(colon + 1);

  const slash = rest.indexOf("/");
  const host = slash === -1 ? rest : rest.slice(0, slash);
  const database = slash === -1 ? "" : decodeURIComponent(rest.slice(slash + 1).split("/")[0] ?? "");

  if (!username) problems.push("the username is empty");
  if (colon === -1 || !password) problems.push("the password is empty");

  // Characters that break the address unless they are written as %XX.
  const unsafe = [...new Set(password.replace(/%[0-9A-Fa-f]{2}/g, "").match(/[@:/?#\[\]%]/g) ?? [])];
  if (unsafe.length > 0) {
    problems.push(`the password contains ${unsafe.map((c) => `"${c}"`).join(" ")}, which must be written as %XX in an address. The simplest fix is a new password with only letters and numbers`);
  }

  if (!host) problems.push("the host (the part after the @) is empty");
  else if (scheme === "mongodb+srv" && !/\.mongodb\.net$/i.test(host)) problems.push(`the host "${host}" doesn't look like an Atlas cluster (it should end in .mongodb.net)`);
  if (!database) problems.push("there is no database name after the host. It should end like /brainboard_prod?retryWrites=true&w=majority");

  return { ok: problems.length === 0, problems, notes, scheme, username, passwordLength: password.length, host, database, cleaned: uri };
}

async function main() {
  const raw = process.env.CHECK_URI ?? "";
  if (!raw.trim()) {
    console.error("Nothing was received. Copy the address in Notepad (Ctrl + A, then Ctrl + C), then run:");
    console.error("  $env:CHECK_URI = Get-Clipboard -Raw");
    process.exit(1);
  }

  const report = analyzeUri(raw);

  if (!report.scheme) {
    console.log("FAIL  what was received isn't a database address:");
    for (const note of report.seen.notes) console.log(`        - ${note}`);
    for (const problem of report.problems) console.log(`        - ${problem}`);
    process.exit(1);
  }

  console.log("The address, taken apart (the password is never shown):");
  console.log(`  kind:             ${report.scheme}`);
  console.log(`  username:         ${report.username ?? "(none)"}`);
  console.log(`  password length:  ${report.passwordLength ?? "?"} characters`);
  console.log(`  host:             ${report.host ?? "(none)"}`);
  console.log(`  database name:    ${report.database || "(none)"}`);

  for (const note of report.notes) console.log(`\nNOTE  ${note}`);
  if (report.problems.length === 0) console.log("\nPASS  the address is shaped correctly");
  for (const problem of report.problems) console.log(`\nFAIL  ${problem}`);

  console.log("\nTrying to connect from this computer (your own address is on Atlas's list)...");
  const mongoose = (await import("mongoose")).default;

  try {
    await mongoose.connect(report.cleaned, { serverSelectionTimeoutMS: 20_000 });
    console.log(`PASS  connected, signed in as "${report.username}"`);

    const count = await mongoose.connection.db.collection("users").estimatedDocumentCount();
    console.log(`PASS  the user can read the database "${mongoose.connection.name}" (users: ${count})`);

    if (mongoose.connection.name.endsWith("_test")) console.log('FAIL  this is a "_test" database, which production refuses');
    console.log("\nThis address works. If Render still says 'bad auth', the value saved in Render differs from this one: paste it again, exactly.");
    await mongoose.disconnect();
  } catch (error) {
    const message = String(error.message ?? error);
    console.log(`\nFAIL  could not use the address: ${message.replace(/mongodb(\+srv)?:\/\/\S+/g, "(address hidden)").slice(0, 220)}`);

    if (/bad auth|Authentication failed/i.test(message)) {
      console.log("\nWhat this means: Atlas does not accept this username and password pair.");
      console.log("  - Check the username matches Database Access exactly (it is case-sensitive).");
      console.log("  - In Atlas: Database Access, Edit the user, Edit Password, choose a NEW password with only letters and numbers, Update User, wait a minute, then rebuild the address with it.");
    } else if (/not authorized|requires authentication/i.test(message)) {
      console.log("\nWhat this means: the sign-in worked, but the user isn't allowed to use this database.");
      console.log("  - In Atlas: Database Access, Edit the user, and give it the privilege readWrite on the database named exactly as in the address.");
    } else if (/ENOTFOUND|querySrv/i.test(message)) {
      console.log("\nWhat this means: the host name wasn't found. Check it against Atlas: Connect, Drivers.");
    } else if (/Could not connect to any servers|ReplicaSetNoPrimary|timed out/i.test(message)) {
      console.log("\nWhat this means: the network, not the password. Your computer's address may not be on Atlas's Network Access list.");
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();