// How much work it takes to check one password. A higher number is slower for an attacker trying
// guesses, and a little slower for us. It's used in two places that must agree: when a password is
// stored, and when a throwaway check is done for an email that has no account (so both take the same time).
export const BCRYPT_ROUNDS = 12;