# YESAS ENGINEERING

Official tagline: Expertise Wired to Perfection.

## Current implementation

This repository currently contains a Django REST Framework backend with
email-based authentication, versioned company and homepage content, and a
service catalogue and project portfolio with revision-based publishing.
Inquiries, testimonials, and media library apps are scaffolded but do not yet
implement their planned features.

The React frontend and deployment infrastructure (Docker, Nginx, and VPS
configuration) are planned components and are not present in this repository.

## Backend stack

- Python 3.12
- Django 6.1.3 and Django REST Framework
- PostgreSQL through `DATABASE_URL` for deployments
- SQLite in-memory database for automated tests
- Pipenv for dependency management

## Local setup

1. Install the dependencies with Pipenv from `backend/`.
2. Copy `.env.example` to `.env` and set a secret key and database URL for the
   environment you intend to use.
3. Run backend checks and tests from `backend/`:

   ```sh
   python manage.py check
   python -m pytest
   ```

The test settings use an isolated in-memory SQLite database. PostgreSQL
integration is not verified by the test suite.

## Project portfolio behavior

Projects have stable slugs, separate content revisions, categories, validated
tags, and optional relationships to existing service identities. Project
availability is independent of revision status; disabling or archiving a
project hides it from public APIs without rewriting its revision history.
Deactivating a category hides its projects publicly while preserving their
category references and revision history. Reactivate the category or move a
draft to an active category before publishing further content.

The project portfolio deliberately stores no image paths, upload fields, or
external cover-image URLs. A future Media Library integration should add
relationships to managed media assets in a separate migration; it must not
accept arbitrary file paths or URLs.

## Production email prerequisite

Production settings use Django's `MAILERS` SMTP backend. Before enabling any
production email-sending feature, provision an SMTP provider and configure
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_TLS`,
`SMTP_USE_SSL`, and `SMTP_TIMEOUT`. The application does not assume a company
domain or mailbox, and startup does not require SMTP credentials while email
sending remains unused.
