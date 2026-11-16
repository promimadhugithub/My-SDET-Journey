# dMoney Integration Testing (Mocha + Chai + Axios)

Batch 20 – Integration Testing assignment. The suite drives the dMoney REST API end to end:
it creates users, activates them, moves money between them and asserts every HTTP status
code, service fee and commission along the way.

## Tech stack

| Tool | Purpose |
| --- | --- |
| [Mocha](https://mochajs.org/) | Test runner |
| [Chai](https://www.chaijs.com/) | Assertions (`expect`) |
| [Axios](https://axios-http.com/) | HTTP client |
| [dotenv](https://github.com/motdotla/dotenv) | Loads configuration from `.env` |

## Project structure

```
.
├── tests/
│   └── dmoney.spec.js     # all test scenarios
├── utils/
│   ├── api.js             # axios client + one helper per API endpoint
│   ├── fees.js            # expected fee / commission rules
│   └── random.js          # unique test-data generators
├── screenshots/           # console output screenshot used in this README
├── .env.example           # copy to .env
├── .gitignore             # node_modules and .env are ignored
└── package.json
```

## Prerequisites

* Node.js 18+ and npm
* The dMoney API running locally (default `http://localhost:5000`)

## Setup

```bash
# 1. install dependencies (mocha, chai, axios, dotenv)
npm install

# 2. create your local config and set BASE_URL to your dMoney server
cp .env.example .env
```

`.env` values:

| Variable | Description | Default |
| --- | --- | --- |
| `BASE_URL` | dMoney API base URL | `http://localhost:5000` |
| `SECRET_KEY` | Sent as `X-AUTH-SECRET-KEY` header | `ROADTOSDET` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin credentials (create + activate users) | `admin@roadtocareer.net` / `1234` |
| `SYSTEM_EMAIL` / `SYSTEM_PASSWORD` | System account credentials | `system@dmoney.com` / `1234` |
| `SYSTEM_ACCOUNT` | System account number used as `from_account` | `SYSTEM` |

> `.env` is git-ignored – never commit it.

## Run the tests

```bash
npm test
```

This runs `mocha tests --timeout 30000`. A fresh set of users (random email, phone and NID)
is generated on every run, so the suite can be re-run any number of times.

## Test scenarios

The scenarios depend on each other and run in order.

| # | Scenario | Assertions |
| --- | --- | --- |
| 0 | Admin login; wrong-password login; create user without token | `200` + token, `401`, `401/403` |
| 1 | Admin creates 2 customers, 1 agent, 1 merchant; duplicate user rejected | `201` ×4, `208` |
| 2 | Admin activates all four users (`PATCH /user/update/:id`) | `200` ×4 |
| 3 | System account deposits **5000 Tk** to the agent | `201`, agent balance = 5000 |
| 4 | Agent deposits **2000 Tk** to customer 1 | `201`, **commission = 2.5% = 50 Tk**, balances updated |
| 5 | Customer 1 sends **1000 Tk** to customer 2; insufficient-balance case | `201`, **fee = 5 Tk**, sender debited 1005, receiver credited 1000, `208` |
| 6 | Customer 2 cashes out **500 Tk** from the agent | `201`, **fee = 1% (min 5) = 5 Tk**, customer debited 505 |
| 7 | Customer 2 pays **400 Tk** to the merchant | `201`, **fee = 1% (min 5) = 5 Tk** deducted from the customer on top of 400 |

### Fee and commission rules used in the assertions

| Transaction | Rule |
| --- | --- |
| Agent deposit commission | 2.5% of the amount |
| Send money fee | flat 5 Tk |
| Cash-out (withdraw) fee | 1% of the amount, minimum 5 Tk |
| Merchant payment fee | 1% of the amount, minimum 5 Tk |

If your local dMoney build uses different rates, change them in one place: `utils/fees.js`.

### Notes

* Every request uses `validateStatus: () => true`, so axios never throws on 4xx/5xx and each
  test can assert the exact HTTP status code.
* Some dMoney builds require an OTP when non-admin users log in. If the login response has no
  token, the suite falls back to the admin token for that user's transactions.

## Console output

<!-- Run `npm test`, take a screenshot of the terminal and save it as screenshots/test-output.png -->

![npm test console output](screenshots/test-output.png)
