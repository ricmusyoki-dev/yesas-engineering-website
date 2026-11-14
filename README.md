# YESAS ENGINEERING

Official tagline: Expertise Wired to Perfection.

## Current implementation

This repository currently contains a Django REST Framework backend with
email-based authentication, versioned company and homepage content, and a
service catalogue, project portfolio, and private media library with
revision-based publishing. Inquiries and testimonials are scaffolded but do
not yet implement their planned features.

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

## Media library

The media library accepts JPEG, PNG, and WebP images and MP4/WebM videos
through authenticated management APIs. Image uploads are decoded, checked
against dimension and pixel limits, re-encoded without source metadata, and
given a WebP thumbnail. Animated images are not accepted. The default limits
are 12 MiB per image, 100 MiB per video, 8192 pixels per image dimension,
20 million image pixels, and 512 pixels per thumbnail; they can be changed
with the corresponding `MEDIA_*` environment variables.

Video validation currently checks the container signature only. It does not
decode the video, inspect its duration or dimensions, or generate a thumbnail.
Do not treat an accepted video as fully decoded or transcoded.

Media files use `MEDIA_PRIVATE_ROOT`, separate from `MEDIA_ROOT` and the
static-file root. Production must provision this as an absolute path on
persistent private storage before starting the application, and restrict its
directory access to the application service account (mode `0700`; stored files
use mode `0600`). Production startup requires `MEDIA_PRIVATE_ROOT`; local
development uses a private directory outside the repository by default.
Back up this volume together with the database.

Content delivery is protected by published revision attachments. Unreferenced
assets are not public; draft and archived assets are not delivered. The Django
application streams files by default. An optional Nginx `X-Accel-Redirect`
configuration can be enabled with `MEDIA_X_ACCEL_PREFIX`, but deployment must
provide a matching `internal` location and alias to the same private volume.
Never expose that volume through a public static or media URL. Public responses
may be cached for up to five minutes.

## Production email prerequisite

Production settings use Django's `MAILERS` SMTP backend. Before enabling any
production email-sending feature, provision an SMTP provider and configure
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_TLS`,
`SMTP_USE_SSL`, and `SMTP_TIMEOUT`. The application does not assume a company
domain or mailbox, and startup does not require SMTP credentials while email
sending remains unused.

The production deployment check also reports Django warning `security.W004`
because `SECURE_HSTS_SECONDS` is unset. Configure HSTS only after the actual
deployment is confirmed to serve the entire site exclusively over HTTPS.
