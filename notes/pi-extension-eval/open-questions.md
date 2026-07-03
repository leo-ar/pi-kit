# Open questions

- Should `pi-hashline-edit-pro` replace the built-in `read`/`edit` path, or should it be opt-in only?
- In edit-heavy sessions, does hashline reduce failed edits enough to justify the extra verbosity?
- Would the best deployment model be "hashline for edits, plain reads for browsing"?
- Does `smart-compact` materially outperform the default compaction path on the specific sessions that matter most?
- Is `context-pruner` best treated as a high-value but situational token saver?
