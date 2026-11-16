// Small helpers for generating unique test data (no extra dependencies needed).

function randomDigits(length) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 10);
  }
  return out;
}

// Bangladeshi style 11 digit phone number, e.g. 01XXXXXXXXX
function randomPhone() {
  return "01" + randomDigits(9);
}

function randomNid() {
  return randomDigits(10);
}

function randomEmail(prefix) {
  return `${prefix}.${Date.now()}${randomDigits(4)}@test.com`;
}

function buildUser(role, label) {
  return {
    name: `${label} ${randomDigits(4)}`,
    email: randomEmail(label.toLowerCase().replace(/\s+/g, "")),
    password: "1234",
    phone_number: randomPhone(),
    nid: randomNid(),
    role,
  };
}

module.exports = { randomDigits, randomPhone, randomNid, randomEmail, buildUser };
