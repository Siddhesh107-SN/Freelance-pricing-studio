# Freelance Pricing Studio

> A full-stack internal estimation, pricing calculation, and professional quotation platform tailored for freelance developers, agencies, and consulting teams.

[![CI](https://github.com/your-username/freelance-pricing-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/freelance-pricing-studio/actions/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org)

---

## Overview

**Freelance Pricing Studio** eliminates guesswork in project bidding and financial estimation. It guides you through a structured, multi-step estimation flow—calculating precise internal delivery costs, profit margins, contingency, and client-facing quotations using exact `Decimal` arithmetic.

Designed with robust security boundaries, the system maintains strict separation between internal financial metrics (developer hourly rates, margins, absorbed tooling expenses) and client-facing documents. Client quotations include payment milestone schedules, customizable terms, and embedded dynamic UPI payment QR codes.

---

## Key Features

- **6-Step Interactive Estimation Wizard:**
  - **Project & Client Setup:** Capture client metadata, project category, and complexity level.
  - **Scope & Feature Selection:** Tier-based selection across pre-configured or custom features (Basic, Intermediate, Advanced).
  - **Developer Workload Allocation:** Assign developer hours and automatically balance internal resource costs.
  - **Expense Tracking:** Granular breakdown of client-billed vs. absorbed tooling/infrastructure expenses.
  - **Pricing Strategy & Margin Engine:** Real-time margin calculator, contingency controls, commercial discounts, GST toggles, and minimum acceptable price floor warnings.
  - **Quotation & Milestone Review:** Milestone breakdown generator (e.g. 40/30/30), revision policies, and automated quotation numbering.

- **Dual-Document Architecture:**
  - **Internal Breakdown:** Comprehensive financial view with developer allocation costs, absorbed expenses, and projected gross/net margins.
  - **Client Quotation:** Clean, professional proposal stripping all sensitive internal rates, hours, and margins.

- **Tamper-Proof Backend Calculation Engine:**
  - All financial math is computed server-side using arbitrary-precision `Decimal` arithmetic (`backend/app/services/calculation_service.py`).
  - Client-submitted totals are ignored; every value is verified against database-backed feature rates.

- **High-Fidelity PDF & HTML Generation:**
  - Server-side document rendering powered by Jinja2 templates and WeasyPrint (with graceful HTML fallback if system font/Pango libraries are unavailable).
  - Dynamic UPI payment QR code generated in pure Python with SVG rendering.

- **Role-Based Access Control (RBAC):**
  - JWT-based authentication with bcrypt password hashing.
  - Granular `admin` vs. `member` permissions (pricing defaults, business branding, and team rates require admin access).

- **Multi-Database Support:**
  - Out-of-the-box support for **MySQL 8** (production, Docker, Codespaces) and **SQLite** (instant zero-dependency local development).

- **Cloud & Container Ready:**
  - Complete `.devcontainer` configuration for one-click setup in **GitHub Codespaces** or VS Code Remote Containers.
  - Automated GitHub Actions CI pipeline covering database migrations, seeding, test suites, and production asset bundling.

---

## Technology Stack

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite 5
- **Styling:** Tailwind CSS & PostCSS
- **State & Forms:** React Hook Form, Zod schema validation
- **Animations & Visualizations:** Framer Motion, Recharts, Lucide React
- **Testing:** Vitest, Testing Library (`@testing-library/react`, `jsdom`)

### Backend
- **Framework:** FastAPI
- **Server:** Uvicorn (ASGI)
- **Database ORM:** SQLAlchemy 2.0
- **Migrations:** Alembic
- **Validation:** Pydantic v2 & Pydantic Settings
- **Authentication:** PyJWT, Bcrypt
- **Document Engine:** WeasyPrint, Jinja2, custom pure-Python QR generator
- **Testing:** Pytest, HTTPX

---

## Project Structure

```text
freelance-pricing-studio/
├── .devcontainer/              # Dev container & Codespaces configuration
│   ├── devcontainer.json       # Toolchains (Node 20, Python 3.12, system packages)
│   └── docker-compose.yml      # Multi-container setup (FastAPI app + MySQL 8)
├── .github/
│   └── workflows/
│       └── ci.yml              # Automated CI workflow (backend + frontend)
├── backend/                    # FastAPI application backend
│   ├── app/
│   │   ├── core/               # App configuration, security, dependencies
│   │   ├── database/           # Engine connection and base declarative model
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── routers/            # API route controllers (auth, estimates, pdf, etc.)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic (calculation, estimate, quotation, pdf)
│   │   ├── templates/          # Jinja2 HTML/CSS templates for PDF quotation rendering
│   │   ├── utils/              # Currency formatting, numbering, SVG QR generator
│   │   ├── main.py             # FastAPI entrypoint and router mounting
│   │   └── seed.py             # Database seeder (categories, rate-card features, users)
│   ├── migrations/             # Alembic database migration scripts
│   ├── tests/                  # Pytest test suite (API tests, calculations, PDF validation)
│   ├── alembic.ini             # Alembic configuration
│   ├── pytest.ini              # Pytest configuration
│   ├── requirements.txt        # Python dependency manifest
│   └── .env.example            # Backend environment template
├── frontend/                   # React + Vite frontend
│   ├── public/                 # Static public assets (default logo)
│   ├── src/
│   │   ├── components/         # Reusable UI & wizard step components
│   │   ├── context/            # Authentication & estimate state contexts
│   │   ├── hooks/              # Custom React hooks (useEstimate, usePricing)
│   │   ├── pages/              # Application pages (EstimateFlow, Settings, Login, etc.)
│   │   ├── services/           # Axios API client and endpoints
│   │   ├── test/               # Vitest test suite and testing setups
│   │   └── utils/              # Client-side calculations, formatting, validation
│   ├── dev.js                  # Unified dev launcher (concurrent backend + frontend)
│   ├── index.html              # Single Page Application entry HTML
│   ├── package.json            # Frontend package manifest and scripts
│   ├── tailwind.config.js      # Tailwind styling configuration
│   ├── vite.config.js          # Vite server & proxy configuration
│   └── .env.example            # Frontend environment template
├── .env.example                # Root environment template
├── .gitignore                  # Comprehensive Git exclusion rules
├── package.json                # Root orchestration scripts
└── README.md                   # Project documentation
```

---

## Prerequisites

Ensure you have the following installed locally:
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Python**: `3.12` or higher (tested with `3.12` and `3.14`)
- **Database**:
  - *Option A (Default for local):* **SQLite** (bundled with Python, no install needed)
  - *Option B (Recommended for production):* **MySQL 8.0+**

> **Note for Windows PDF Generation:** WeasyPrint relies on GTK/Pango libraries. If GTK is not installed on Windows, all endpoints and features function normally, and PDF endpoints provide an HTML view fallback via `?format=html`.

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/freelance-pricing-studio.git
cd freelance-pricing-studio
```

### 2. Configure Environment Variables

Copy the provided environment template:

```bash
# In the project root (or inside backend/)
cp .env.example backend/.env
```

Open `backend/.env` and update the required values:

```ini
# For SQLite quick start:
DATABASE_URL=sqlite:///./freelance.db

# Or for MySQL:
# DATABASE_URL=mysql+pymysql://root:password@localhost:3306/freelance_pricing?charset=utf8mb4

# Change this to a secure random string (minimum 32 characters):
JWT_SECRET=your-secure-random-secret-key-min-32-chars

# Initial admin and team credentials (used during database seeding):
SEED_USER1_NAME=Developer One
SEED_USER1_EMAIL=dev1@example.com
SEED_USER1_PASSWORD=your-secure-password-1

SEED_USER2_NAME=Developer Two
SEED_USER2_EMAIL=dev2@example.com
SEED_USER2_PASSWORD=your-secure-password-2
```

### 3. Setup Python Virtual Environment & Dependencies

```bash
cd backend
python -m venv .venv

# Activate virtual environment:
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On macOS / Linux:
source .venv/bin/activate

# Install backend dependencies:
pip install -r requirements.txt
```

### 4. Run Database Migrations & Seed Data

```bash
# Apply database schema migrations:
alembic upgrade head

# Seed initial categories, features, and default admin accounts:
python -m app.seed

# Return to root directory:
cd ..
```

### 5. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Running the Application

### Option 1: Unified Development Command (Recommended)

From the project root:

```bash
npm run dev
```

This single command automatically launches:
- **Backend API:** `http://localhost:8000` (auto-reloading via Uvicorn)
- **Frontend App:** `http://localhost:5173` (Vite dev server)
- Pressing `Ctrl + C` cleanly terminates both processes.

### Option 2: Running Independently

**Terminal 1 (Backend):**
```bash
cd backend
# Windows:
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
# macOS / Linux:
./.venv/bin/uvicorn app.main:app --reload --port 8000
```

**Terminal 2 (Frontend):**
```bash
npm run dev:frontend
```

---

## Cloud Development (GitHub Codespaces / Dev Containers)

You can run this entire application directly in the cloud without installing any runtimes locally:

1. Open the repository on GitHub.
2. Click **Code** > **Codespaces** > **Create codespace on main**.
3. Once loaded, the environment automatically provisions Python 3.12, Node 20, GTK/Pango, and a MySQL 8 container.
4. Execute:
   ```bash
   npm run dev
   ```
5. Access the forwarded ports (`5173` for UI, `8000` for API).

---

## Available API Endpoints

Interactive Swagger API documentation is available at `http://localhost:8000/docs` and Redoc at `http://localhost:8000/redoc`.

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Service health status check | Public |
| `POST` | `/api/auth/login` | Authenticate with email/password; returns JWT | Public |
| `GET` | `/api/auth/me` | Fetch currently authenticated user profile | Yes (Bearer) |
| `POST` | `/api/auth/logout` | Invalidate client session token | Yes (Bearer) |
| `GET` | `/api/categories` | List all service categories and active features | Yes (Bearer) |
| `POST` | `/api/categories` | Create custom service category | Admin |
| `GET` | `/api/features` | Retrieve all features and tier rates | Yes (Bearer) |
| `PUT` | `/api/features/{id}` | Update feature pricing, estimated hours, or status | Admin |
| `POST` | `/api/estimates` | Calculate, validate, and save new estimate | Yes (Bearer) |
| `GET` | `/api/estimates` | List historical estimates with search and filter | Yes (Bearer) |
| `GET` | `/api/estimates/{id}` | Retrieve estimate details by ID | Yes (Bearer) |
| `POST` | `/api/estimates/preview` | Preview calculation totals without persisting | Yes (Bearer) |
| `DELETE` | `/api/estimates/{id}` | Soft-delete an estimate record | Yes (Bearer) |
| `GET` | `/api/estimates/{id}/pdf/internal` | Generate internal financial breakdown (PDF/HTML) | Yes (Bearer) |
| `GET` | `/api/estimates/{id}/pdf/client` | Generate client quotation document (PDF/HTML) | Yes (Bearer) |
| `GET` | `/api/settings` | Retrieve business branding, terms, and payment settings | Yes (Bearer) |
| `PUT` | `/api/settings` | Update business branding, terms, and UPI settings | Admin |
| `POST` | `/api/settings/logo` | Upload brand logo image (PNG/JPEG/WebP) | Admin |
| `GET` | `/api/team-members` | List team members and internal hourly rates | Yes (Bearer) |
| `PUT` | `/api/team-members/{id}` | Update team member rates or details | Admin |

---

## Running Automated Tests

### Frontend Test Suite (Vitest)
```bash
npm test
# Or inside frontend directory:
cd frontend && npm test
```

### Frontend Production Build Test
```bash
npm run build
```

### Backend Test Suite (Pytest)
```bash
cd backend
# Windows:
.\.venv\Scripts\pytest.exe -q
# macOS / Linux:
pytest -q
```

---

## Screenshots & UI Walkthrough

*(Add your application screenshots here after initial deployment)*

```text
+-----------------------------------------------------------------------+
|  [Step 1: Project] -> [Step 2: Features] -> [Step 3: Dev Allocation]  |
|  [Step 4: Expenses] -> [Step 5: Pricing Engine] -> [Step 6: Review]   |
+-----------------------------------------------------------------------+
|  Real-time Sticky Price Bar:                                          |
|  Client Price: ₹ 85,000 | Internal Cost: ₹ 42,000 | Margin: 50.6%     |
+-----------------------------------------------------------------------+
```

---

## Calculation Rules & Business Logic

1. **Internal Cost Derivation:**
   - Development cost is calculated directly from Step 3 developer hour allocation (`hours × hourly_rate`).
   - Feature-level base hours are used as defaults only when no manual allocation is provided, preventing double-counting of development time.
2. **Expense Classification:**
   - One-time vs. recurring monthly expenses are segmented.
   - Client-billed expenses are added to the proposal subtotal; absorbed expenses impact only internal margin.
3. **Contingency Strategy:**
   - Contingency is always computed in the internal cost safety cushion.
   - When "Include in client price" is enabled, it is transparently labeled for the client as *"Project management and delivery assurance"*.
4. **GST / Tax Handling:**
   - Defaults to disabled. When enabled, GST (e.g. 18%) is computed on the post-discount taxable subtotal.
5. **Data Whitelisting for Clients:**
   - The client PDF serializer strictly excludes all internal developer identities, internal hourly rates, profit margins, and absorbed cost items.

---

## Future Roadmap

- [ ] **Multi-Currency Support:** Dynamic conversion between INR, USD, EUR, and GBP with live exchange rates.
- [ ] **Client Proposal Portal:** Interactive client link allowing clients to accept quotations and select optional add-ons online.
- [ ] **Webhook & Accounting Integration:** Direct export to QuickBooks, Zoho Books, or Stripe Invoicing.
- [ ] **Time Tracking Integration:** Compare actual tracked delivery hours against estimated allocation hours.

---

## Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

Please ensure all frontend and backend tests pass before submitting a PR.

---

## License

This project is currently provided for internal and private evaluation. For licensing options (e.g., MIT, Apache 2.0, or Proprietary), please refer to the project repository or contact the project maintainer.

---

## Author & Maintainers

Maintained with ❤️ by the development team.  
For technical support and questions, please submit an issue through the GitHub repository issue tracker.
#   F r e e l a n c e - p r i c i n g - s t u d i o  
 