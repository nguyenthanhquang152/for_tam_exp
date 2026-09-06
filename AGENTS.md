# Project workflows

For new/corrected raw data, changed workbook formats, or a heatmap release, use
[`update-shrimp-heatmap`](.agents/skills/update-shrimp-heatmap/SKILL.md). It covers
intake, adapter decisions, standardization, verification and authorized delivery.
Routine source refactors or visual edits do not require a new-data intake.

Repository architecture and commands are in `README.md` and `docs/architecture.md`.
Keep original workbooks in `raw/`, canonical plot inputs in `standardized/`, the
standalone release in `dist/`, and reviewed figures in `reports/`. Missing values
and unlisted taxa are not zero detections. Current corpus totals are regression
evidence, not permanent limits on future sources.

A skill does not grant external-write permission. Follow the current user's
publication scope and existing session authorization.
