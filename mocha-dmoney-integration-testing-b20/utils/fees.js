// Expected fee / commission rules of the dMoney platform.
// If your local dMoney build uses different numbers, change them here only.

const RULES = {
  agentDepositCommissionRate: 0.025, // 2.5% of deposit amount, paid to the agent
  sendMoneyFee: 5, // flat 5 Tk
  feeRate: 0.01, // 1% for cash-out (withdraw) and merchant payment
  minFee: 5, // ...with a minimum of 5 Tk
};

const round2 = (n) => Math.round(n * 100) / 100;

function depositCommission(amount) {
  return round2(amount * RULES.agentDepositCommissionRate);
}

function sendMoneyFee() {
  return RULES.sendMoneyFee;
}

function percentFee(amount) {
  return round2(Math.max(amount * RULES.feeRate, RULES.minFee));
}

// cash-out (customer -> agent) and payment (customer -> merchant) use the same fee rule
const withdrawFee = percentFee;
const paymentFee = percentFee;

module.exports = { RULES, depositCommission, sendMoneyFee, withdrawFee, paymentFee };
