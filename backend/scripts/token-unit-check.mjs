// A self-test for login tokens: which ones are accepted, which are refused, and the fingerprint
// used to end a session. It needs no running backend and no database, only your .env.
//
// Run it from the backend folder:
//   node scripts/token-unit-check.mjs

import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { BCRYPT_ROUNDS } from "../constants/security.js";
import { hashToken, signToken, verifyToken } from "../utils/token.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const ID = "a1b2c3d4e5f60718293a4b5c";
const now = () => Math.floor(Date.now() / 1000);

const b64 = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const HASHES = { HS256: "sha256", HS512: "sha512" };

// Builds a token by hand, with no checks, so odd ones can be made.
function signRaw(payload, { alg = "HS256", secret = env.jwtSecret } = {}) {
  const input = `${b64({ alg, typ: "JWT" })}.${b64(payload)}`;
  if (alg === "none") return `${input}.`;
  return `${input}.${crypto.createHmac(HASHES[alg], secret).update(input).digest("base64url")}`;
}

const refused = (token) => {
  try {
    verifyToken(token);
    return false;
  } catch {
    return true;
  }
};

console.log("Checking login tokens\n");

// ---------- A real token ----------
const real = signToken(ID);
const payload = verifyToken(real);

check("A real token has three parts", real.split(".").length === 3);
check("It carries only who, when it was made and when it ends", JSON.stringify(Object.keys(payload).sort()) === JSON.stringify(["exp", "iat", "sub"]), Object.keys(payload).join(","));
check("...and who it is for", payload.sub === ID);
check("...and it ends later than it began", payload.exp > payload.iat);
check("An id that isn't text is turned into text", verifyToken(signToken({ toString: () => ID })).sub === ID);
check("Capital letters in an id are fine", verifyToken(signToken(ID.toUpperCase())).sub === ID.toUpperCase());

// ---------- Tokens that must be refused ----------
check("An expired token is refused", refused(signRaw({ sub: ID, exp: now() - 60 })));
check("A token signed with the wrong secret is refused", refused(signRaw({ sub: ID, exp: now() + 3600 }, { secret: "not-the-real-secret-at-all-0123456789" })));
check("A token using a different algorithm (HS512) is refused", refused(signRaw({ sub: ID, exp: now() + 3600 }, { alg: "HS512" })));
check("A token with no signature (alg none) is refused", refused(signRaw({ sub: ID, exp: now() + 3600 }, { alg: "none" })));
check("A token that never expires is refused", refused(signRaw({ sub: ID })));

check("A token with no 'who' is refused", refused(signRaw({ exp: now() + 3600 })));
check("A token whose 'who' is a number is refused", refused(signRaw({ sub: 12345, exp: now() + 3600 })));
check("A token whose 'who' is a database query is refused", refused(signRaw({ sub: { $ne: null }, exp: now() + 3600 })));
check("A token whose 'who' is a list is refused", refused(signRaw({ sub: [ID], exp: now() + 3600 })));
check("A token whose 'who' is too short is refused", refused(signRaw({ sub: "123", exp: now() + 3600 })));
check("A token whose 'who' is too long is refused", refused(signRaw({ sub: `${ID}ff`, exp: now() + 3600 })));
check("A token whose 'who' has odd characters is refused", refused(signRaw({ sub: "g".repeat(24), exp: now() + 3600 })) && refused(signRaw({ sub: `${ID.slice(0, 23)}/`, exp: now() + 3600 })));

check("Nonsense is refused", ["", "not.a.token", "a.b.c", "....", " ", real.slice(0, -3), `${real} `, `x${real}`].every(refused));
check("Nothing at all is refused", refused(undefined) && refused(null));

// A control: the library's own signer, to make sure the checks above are about OUR rules.
check("(control) a normally signed token with the real secret is accepted", !refused(jwt.sign({ sub: ID }, env.jwtSecret, { algorithm: "HS256", expiresIn: "1h" })));

// ---------- The fingerprint ----------
const first = hashToken(real);
check("A fingerprint is 64 letters and numbers", /^[a-f0-9]{64}$/.test(first));
check("The same token always gives the same fingerprint", hashToken(real) === first);
check("A different token gives a different fingerprint", hashToken(signToken("f".repeat(24))) !== first);
check("A fingerprint doesn't contain the token", !first.includes(real.slice(0, 12)));
check("Changing one character changes the fingerprint", hashToken(`${real}x`) !== first);

// ---------- Passwords ----------
check("The password work factor is set, and strong", Number.isInteger(BCRYPT_ROUNDS) && BCRYPT_ROUNDS >= 12);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);