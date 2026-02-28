---
title: What is Vitals?
description: Learn about Vitals, a VS Code extension that brings real-time observability, metrics, logs, and alerts directly to your development environment.
head:
  - - meta
    - name: keywords
      content: Vitals introduction, VS Code observability, developer monitoring tools, application insights, Prometheus integration
---

# What is Vitals?

**Vitals** is a developer-first observability tool designed to bring real-time application insights directly into your Visual Studio Code environment.

## The Problem

Modern development often involves a constant cycle of context switching:

1. Write code in VS Code.
2. Switch to a terminal to check logs.
3. Switch to a browser (Grafana/Prometheus) to check metrics.
4. Switch back to VS Code to fix issues.

This friction breaks your flow and slows down the feedback loop.

## The Solution

Vitals integrates these essential observability signals right where you work. By connecting directly to your local or remote Prometheus instance, Vitals provides a unified view of your application's health without you ever leaving the editor.

## Key Capabilities

### Real-Time Metrics Dashboard

Visualize critical system and application metrics—such as CPU usage, memory consumption, and request latency—with beautiful, auto-updating charts. Vitals uses `@observablehq/plot` to render high-performance visualizations that look native to VS Code.

### Command-Line Interface for CI/CD

A comprehensive CLI for automated performance testing in your deployment pipeline. Detect regressions with statistical confidence, enforce performance policies, and compare against historical baselines—all from the command line.

### Live Log Stream

Debug faster with a terminal-like log viewer. It features syntax highlighting for log levels (INFO, WARN, ERROR) and auto-scrolling, giving you immediate visibility into your application's behavior as you test it.

### Instant Alerts

Never miss a critical issue. The Alerts Panel shows you firing and pending Prometheus alerts in real-time, complete with status indicators and detailed descriptions.

## Design Philosophy

- **Zero Configuration**: We believe tools should just work. Vitals detects standard local Prometheus setups automatically.
- **Aesthetic & Native**: The UI is built to blend seamlessly with VS Code's design system, respecting your theme and layout preferences.
- **Performance First**: Built with a lightweight architecture that ensures your editor remains snappy, even when streaming data.

## Who is this for?

- **Backend Developers** building microservices who need to see the impact of their changes immediately.
- **SREs** debugging incidents who want to correlate code with metrics.
- **Full Stack Engineers** who prefer a unified development environment.

---

Ready to get started? Check out the [Quick Start Guide](getting_started.md).
