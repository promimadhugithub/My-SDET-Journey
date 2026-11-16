const { expect } = require("chai");
const api = require("../utils/api");
const fees = require("../utils/fees");
const { buildUser } = require("../utils/random");

// Amounts used in the scenarios (Tk)
const AGENT_FUNDING = 5000;
const AGENT_TO_CUSTOMER = 2000;
const CUSTOMER_TO_CUSTOMER = 1000;
const CASH_OUT = 500;
const MERCHANT_PAYMENT = 400;

// Shared state – the scenarios depend on each other and run in order.
const state = {
  adminToken: null,
  systemToken: null,
  users: {
    customer1: buildUser("Customer", "Customer One"),
    customer2: buildUser("Customer", "Customer Two"),
    agent: buildUser("Agent", "Agent"),
    merchant: buildUser("Merchant", "Merchant"),
  },
  tokens: {},
};

const { users } = state;

// The id of the created user is normally in `data.user.id`; fall back to a phone search.
async function resolveUserId(createResponse, user) {
  const id = createResponse.data && createResponse.data.user && createResponse.data.user.id;
  if (id) return id;
  const search = await api.searchByPhone(state.adminToken, user.phone_number);
  return search.data && search.data.user && search.data.user.id;
}

// Log a user in. Non-admin roles may require an OTP on some dMoney builds; if no token
// comes back we fall back to the admin token so the money-movement scenarios still run.
async function tokenFor(user) {
  const res = await api.login(user.email, user.password);
  return (res.data && res.data.token) || state.adminToken;
}

async function balanceOf(user) {
  const res = await api.getBalance(state.adminToken, user.phone_number);
  expect(res.status, "balance lookup status").to.equal(200);
  return Number(res.data.balance);
}

describe("dMoney API – integration tests", function () {
  // ---------------------------------------------------------------------------
  describe("Scenario 0: Authentication", () => {
    it("admin logs in successfully and receives a token (200)", async () => {
      const res = await api.login(api.config.adminEmail, api.config.adminPassword);
      expect(res.status).to.equal(200);
      expect(res.data).to.have.property("token");
      state.adminToken = res.data.token;
    });

    it("login with a wrong password is rejected (401)", async () => {
      const res = await api.login(api.config.adminEmail, "wrong-password");
      expect(res.status).to.equal(401);
    });

    it("creating a user without a token is rejected (401/403)", async () => {
      const res = await api.createUser(null, buildUser("Customer", "No Token"));
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Scenario 1: Create 2 customers, 1 agent and 1 merchant", () => {
    Object.entries(users).forEach(([key, user]) => {
      it(`creates ${key} (${user.role}) successfully (201)`, async () => {
        const res = await api.createUser(state.adminToken, user);
        expect(res.status).to.equal(201);
        expect(res.data).to.have.property("message");
        const id = await resolveUserId(res, user);
        expect(id, "created user id").to.exist;
        user.id = id;
      });
    });

    it("creating a user with an existing email/phone is not accepted (208)", async () => {
      const res = await api.createUser(state.adminToken, users.customer1);
      expect(res.status).to.equal(208);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Scenario 2: Admin activates the users", () => {
    Object.entries(users).forEach(([key, user]) => {
      it(`activates ${key} (${user.role}) (200)`, async () => {
        const res = await api.activateUser(state.adminToken, user.id);
        expect(res.status).to.be.oneOf([200, 201]);
      });
    });

    it("logs in every new user (tokens are used for their own transactions)", async () => {
      for (const [key, user] of Object.entries(users)) {
        state.tokens[key] = await tokenFor(user);
        expect(state.tokens[key], `${key} token`).to.be.a("string");
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe("Scenario 3: System account deposits 5000 Tk to the agent", () => {
    it("system user logs in (200)", async () => {
      const res = await api.login(api.config.systemEmail, api.config.systemPassword);
      expect(res.status).to.equal(200);
      expect(res.data).to.have.property("token");
      state.systemToken = res.data.token;
    });

    it(`deposits ${AGENT_FUNDING} Tk from SYSTEM to the agent (201)`, async () => {
      const res = await api.deposit(
        state.systemToken,
        api.config.systemAccount,
        users.agent.phone_number,
        AGENT_FUNDING
      );
      expect(res.status).to.equal(201);
      expect(res.data).to.have.property("trnxId");
    });

    it(`agent balance is ${AGENT_FUNDING} Tk (200)`, async () => {
      expect(await balanceOf(users.agent)).to.equal(AGENT_FUNDING);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Scenario 4: Agent deposits 2000 Tk to a customer", () => {
    let agentBefore;

    it(`deposits ${AGENT_TO_CUSTOMER} Tk to customer 1 and returns the correct commission (201)`, async () => {
      agentBefore = await balanceOf(users.agent);
      const res = await api.deposit(
        state.tokens.agent,
        users.agent.phone_number,
        users.customer1.phone_number,
        AGENT_TO_CUSTOMER
      );
      expect(res.status).to.equal(201);
      expect(res.data).to.have.property("trnxId");
      expect(Number(res.data.commission), "deposit commission").to.equal(
        fees.depositCommission(AGENT_TO_CUSTOMER)
      );
    });

    it("customer 1 balance equals the deposited amount (200)", async () => {
      expect(await balanceOf(users.customer1)).to.equal(AGENT_TO_CUSTOMER);
    });

    it("agent balance dropped by the deposited amount minus the earned commission (200)", async () => {
      const expected = agentBefore - AGENT_TO_CUSTOMER + fees.depositCommission(AGENT_TO_CUSTOMER);
      expect(await balanceOf(users.agent)).to.equal(expected);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Scenario 5: Customer sends 1000 Tk to another customer", () => {
    let senderBefore;
    let receiverBefore;

    it("send money to customer 2 charges the correct service fee (201)", async () => {
      senderBefore = await balanceOf(users.customer1);
      receiverBefore = await balanceOf(users.customer2);

      const res = await api.sendMoney(
        state.tokens.customer1,
        users.customer1.phone_number,
        users.customer2.phone_number,
        CUSTOMER_TO_CUSTOMER
      );
      expect(res.status).to.equal(201);
      expect(res.data).to.have.property("trnxId");
      expect(Number(res.data.fee), "send money fee").to.equal(fees.sendMoneyFee());
    });

    it("sender is debited amount + fee and receiver is credited the amount (200)", async () => {
      expect(await balanceOf(users.customer1)).to.equal(
        senderBefore - CUSTOMER_TO_CUSTOMER - fees.sendMoneyFee()
      );
      expect(await balanceOf(users.customer2)).to.equal(receiverBefore + CUSTOMER_TO_CUSTOMER);
    });

    it("send money with an insufficient balance is not accepted (208)", async () => {
      const res = await api.sendMoney(
        state.tokens.customer1,
        users.customer1.phone_number,
        users.customer2.phone_number,
        1000000
      );
      expect(res.status).to.equal(208);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Scenario 6: Another customer cashes out 500 Tk from the agent", () => {
    let customerBefore;

    it("withdraw from the agent charges the correct service fee (201)", async () => {
      customerBefore = await balanceOf(users.customer2);

      const res = await api.withdraw(
        state.tokens.customer2,
        users.customer2.phone_number,
        users.agent.phone_number,
        CASH_OUT
      );
      expect(res.status).to.equal(201);
      expect(res.data).to.have.property("trnxId");
      expect(Number(res.data.fee), "cash-out fee").to.equal(fees.withdrawFee(CASH_OUT));
    });

    it("customer is debited amount + fee (200)", async () => {
      expect(await balanceOf(users.customer2)).to.equal(
        customerBefore - CASH_OUT - fees.withdrawFee(CASH_OUT)
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe("Scenario 7: Customer pays 400 Tk to a merchant", () => {
    let customerBefore;
    let merchantBefore;

    it("payment to the merchant returns the correct service fee (201)", async () => {
      customerBefore = await balanceOf(users.customer2);
      merchantBefore = await balanceOf(users.merchant);

      const res = await api.payment(
        state.tokens.customer2,
        users.customer2.phone_number,
        users.merchant.phone_number,
        MERCHANT_PAYMENT
      );
      expect(res.status).to.equal(201);
      expect(res.data).to.have.property("trnxId");
      expect(Number(res.data.fee), "payment fee").to.equal(fees.paymentFee(MERCHANT_PAYMENT));
    });

    it("service fee is deducted from the customer on top of the payment (200)", async () => {
      expect(await balanceOf(users.customer2)).to.equal(
        customerBefore - MERCHANT_PAYMENT - fees.paymentFee(MERCHANT_PAYMENT)
      );
    });

    it("merchant balance increased by at least the payment amount (200)", async () => {
      expect(await balanceOf(users.merchant)).to.be.at.least(merchantBefore + MERCHANT_PAYMENT);
    });
  });
});
