from dotenv import load_dotenv
load_dotenv()
"""Seed accounts, categories, features (starting prices from the 2026 India rate card), team and settings.

Run once after migrations:  python -m app.seed
Prices and hours not listed in the rate card are placeholders. Review them on the Pricing page.
"""
import os
from decimal import Decimal as D

from app.core.security import hash_password
from app.database.connection import SessionLocal
from app.models import BusinessSettings, Feature, ServiceCategory, TeamMember, User

CATEGORIES = [
    ("Website Development", "Business sites, portfolios, landing pages and e-commerce"),
    ("Dashboard Development", "Admin, analytics, CRM and reporting dashboards"),
    ("Custom Web Applications", "Appointment, enquiry, SaaS and internal business apps"),
    ("AI Automation", "AI workflows, chatbots and document processing"),
    ("AI Voice Agents", "Inbound and outbound AI calling agents"),
]

# (category index, name, description, hours, basic, intermediate, advanced)
F = [
    (0, "UI/UX design", "Layout, visual design and page mockups", 12, 5000, 8000, 12000),
    (0, "Frontend development", "Responsive pages built from the approved design", 24, 15000, 25000, 35000),
    (0, "Backend development", "Server logic and business rules", 20, 5000, 10000, 18000),
    (0, "Responsive design", "Desktop, tablet and mobile layouts", 6, 2000, 3000, 5000),
    (0, "Additional pages", "Extra static pages, priced per page", 4, 1500, 2000, 2500),
    (0, "Authentication", "Registration and login; roles at higher tiers", 12, 5000, 8000, 15000),
    (0, "Admin panel", "Panel to manage site content and data", 16, 8000, 12000, 15000),
    (0, "Database integration", "Schema design, setup and connection", 10, 5000, 7500, 10000),
    (0, "Contact forms", "Enquiry form with email delivery", 4, 2000, 3000, 4000),
    (0, "Payment gateway", "Online payment integration", 10, 5000, 7500, 10000),
    (0, "API integrations", "Third-party REST APIs, priced per API", 8, 3000, 4500, 6000),
    (0, "SEO setup", "On-page SEO and social links", 4, 2000, 3500, 5000),
    (0, "Testing", "Functional and device testing before launch", 8, 2000, 4000, 7000),
    (0, "Deployment", "Publish to hosting with domain and SSL", 6, 2000, 5000, 12000),
    (1, "Dashboard interface", "Screens, navigation and filters", 20, 8000, 12000, 15000),
    (1, "Charts and visualizations", "Charts and summary widgets", 12, 3000, 6000, 10000),
    (1, "Authentication", "Login and session handling", 10, 5000, 8000, 15000),
    (1, "Role-based access control", "Roles and permissions", 12, 8000, 12000, 15000),
    (1, "Database integration", "Schema, queries and migrations", 10, 5000, 7500, 10000),
    (1, "API integration", "Data sources through REST APIs", 8, 3000, 4500, 6000),
    (1, "Reporting", "Saved and scheduled reports", 12, 4000, 7000, 12000),
    (1, "Export functionality", "CSV, Excel or PDF export", 6, 2000, 3500, 6000),
    (1, "Testing", "Functional and data accuracy testing", 8, 2000, 4000, 7000),
    (1, "Deployment", "Production setup and handover", 6, 4000, 7000, 12000),
    (2, "Frontend development", "Application screens and interactions", 40, 15000, 25000, 45000),
    (2, "Backend development", "API, services and background jobs", 40, 10000, 20000, 40000),
    (2, "Database architecture", "Data model, relations and migrations", 12, 5000, 7500, 10000),
    (2, "Authentication", "Login, recovery and sessions", 10, 5000, 8000, 15000),
    (2, "User management", "Users, invitations and profiles", 10, 4000, 7000, 12000),
    (2, "Business logic", "Workflow rules specific to the client", 30, 8000, 15000, 30000),
    (2, "API development", "REST endpoints for the application", 12, 6000, 10000, 15000),
    (2, "Third-party integrations", "Email, SMS, maps and similar services", 8, 3000, 5500, 8000),
    (2, "Admin panel", "Back-office tools", 16, 8000, 12000, 15000),
    (2, "Testing", "Automated and manual testing", 12, 3000, 6000, 10000),
    (2, "Deployment", "Full-stack deployment and handover", 8, 7000, 9500, 12000),
    (3, "Workflow analysis", "Map the current process and find what to automate", 8, 5000, 8000, 12000),
    (3, "AI API integration", "Connect a language or vision model", 12, 10000, 15000, 25000),
    (3, "Prompt engineering", "Prompts, evaluation and guardrails", 8, 4000, 7000, 12000),
    (3, "Automation development", "Build the automated workflow", 24, 10000, 20000, 35000),
    (3, "Third-party integrations", "Connect existing business tools", 8, 3000, 5500, 8000),
    (3, "Database integration", "Store workflow data and results", 8, 5000, 7500, 10000),
    (3, "Testing", "Accuracy and failure-case testing", 8, 3000, 5000, 8000),
    (3, "Deployment", "Production setup and monitoring basics", 6, 3000, 6000, 10000),
    (4, "Voice agent configuration", "Call flows, persona and fallback rules", 12, 10000, 15000, 25000),
    (4, "AI model integration", "Connect the language model", 12, 10000, 15000, 25000),
    (4, "Speech-to-text", "Transcription provider setup", 8, 4000, 7000, 12000),
    (4, "Text-to-speech", "Voice selection and tuning", 8, 4000, 7000, 12000),
    (4, "Telephony integration", "Phone numbers and call routing", 16, 8000, 12000, 20000),
    (4, "Appointment booking", "Calendar lookup and booking", 12, 6000, 10000, 15000),
    (4, "CRM integration", "Sync calls and leads to a CRM", 10, 5000, 8000, 12000),
    (4, "Webhook integration", "Events to client systems", 6, 3000, 5000, 8000),
    (4, "Testing", "Call quality and edge-case testing", 10, 4000, 7000, 12000),
    (4, "Deployment", "Production setup and monitoring", 8, 4000, 7000, 12000),
]

TERMS = "\n".join([
    "Work begins after the signed scope and the advance payment.",
    "Any work outside the approved scope needs a change request and a revised estimate.",
    "Client delays in providing content, access or approvals may move the delivery timeline.",
    "Domain, hosting, cloud, paid services and third-party API usage are billed to the client at actual cost.",
    "Source code and credentials transfer to the client after the final payment.",
    "A limited post-launch bug-fix period applies to defects against the agreed scope.",
])


def run() -> None:
    db = SessionLocal()
    try:
        for i in (1, 2):
            email = os.environ.get(f"SEED_USER{i}_EMAIL", f"dev{i}@example.com").lower()
            pw = os.environ.get(f"SEED_USER{i}_PASSWORD", "")
            if len(pw) < 10:
                raise SystemExit(f"Set SEED_USER{i}_PASSWORD (at least 10 characters) in .env")
            if not db.query(User).filter(User.email == email).first():
                db.add(User(name=os.environ.get(f"SEED_USER{i}_NAME", f"Developer {i}"), email=email,
                            password_hash=hash_password(pw), role="admin"))
        if not db.query(TeamMember).count():
            db.add_all([TeamMember(name="Developer 1", internal_hourly_rate=D(500)),
                        TeamMember(name="Developer 2", internal_hourly_rate=D(500))])
        if not db.query(BusinessSettings).count():
            db.add(BusinessSettings(
                business_name=os.environ.get("SEED_BUSINESS_NAME", "Logic Loops"),
                tagline=os.environ.get("SEED_BUSINESS_TAGLINE", "Software Architecture & Design Studio"),
                brand_color=os.environ.get("SEED_BUSINESS_BRAND_COLOR", "#111827"),
                upi_id=os.environ.get("SEED_BUSINESS_UPI_ID", "yourname@upi"),
                gstin=os.environ.get("SEED_BUSINESS_GSTIN", "27AAAAA0000A1Z5"),
                logo_path="logo.png", quotation_prefix="QT", quotation_validity_days=15,
                payment_terms="40% advance, 30% after the development milestone, 30% before final delivery.",
                revision_policy="Two revision rounds are included. Further changes are quoted as change requests.",
                terms_and_conditions=TERMS,
                extra_defaults={"revision_limit": 2, "hours_per_day": 6,
                                "milestones": [["Advance on project confirmation", 40], ["After development milestone", 30],
                                               ["Before final delivery", 30]],
                                "maintenance_prices": {"basic": "1500", "standard": "3000", "premium": "5000"}}))
        if not db.query(ServiceCategory).count():
            cats = [ServiceCategory(name=n, description=d, sort_order=i) for i, (n, d) in enumerate(CATEGORIES)]
            db.add_all(cats)
            db.flush()
            for order, (ci, name, desc, hrs, b, m, a) in enumerate(F):
                active = False if name == "Deployment" else True
                db.add(Feature(category_id=cats[ci].id, name=name, description=desc, estimated_hours=D(hrs),
                               basic_price=D(b), intermediate_price=D(m), advanced_price=D(a), sort_order=order, active=active))
        else:
            db.query(Feature).filter(Feature.name == "Deployment").update({"active": False})
        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run()

