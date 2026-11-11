# Product Brief

## One-liner

Simon is a local Pi-powered assistant with a persistent, dockable chat interface designed to become a controlled engineering copilot.

## Target user

An engineer who wants an assistant available beside their work without using a terminal as the normal product interface.

## Problem

Agent runtimes are useful but their terminal interfaces, runtime-specific events, and tool permissions do not directly provide a polished application experience. The user needs persistent conversations, visible activity, commands, model controls, and trustworthy review boundaries in one local interface.

## Core value proposition

Simon provides a familiar application chat surface while keeping Pi execution, credentials, sessions, policy, and qualified read-only engineering integrations behind a controlled backend.

## Current MVP outcome

The user can:

- open Simon from any application page;
- use it as an overlay or pinned panel;
- create, stream, stop, resume, rename, and delete Pi conversations;
- select supported models and thinking levels;
- use slash commands and inspect truthful activity;
- exercise Manual/Auto review behavior using clearly synthetic actions;
- understand what data leaves the machine and what capabilities are unavailable;
- explicitly attach a conversation to an engineer-selected TIA Portal V20 project in read-only mode;
- create bounded project snapshots and retrieve cited blocks, types, tags, references, and supported source evidence;
- see snapshot freshness, partial coverage, ambiguity, and stale-state limitations;
- search locally indexed, version-aware Siemens installed help with source, applicability, freshness, and rights labels;
- infer convention drafts only from host-authorized examples and use only engineer-approved immutable revisions as assistant guidance.

## Non-goals for this slice

- PLC project mutation, compilation, import, save, download, deployment, or online operation.
- Model-controlled TIA attachment, detach, snapshot refresh, source export, artifact lifecycle, documentation ingestion/refresh, or convention approval/lifecycle.
- Raw or arbitrary MCP exposure beyond Simon-owned classified read contracts.
- Arbitrary URL/file ingestion, general shell or filesystem access, or external-provider upload of proprietary Siemens help.
- Multi-user SaaS, billing, organizations, or cloud hosting.
- Executable self-customization or automatic publication.
