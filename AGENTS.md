# Working rules

Do as much authorized work as possible, with short progress updates. Say what is missing or unverified before finishing.

Before finishing an app change, test every existing feature of the affected app for regressions, including its file operations, keyboard controls, touch interactions, and responsive layout. Add a regression for each reported bug. Check the visible or exported result, not just the input's value. Fix failures and rerun the affected checks. Preserve unrelated worktree changes.

For SVG Paint, run both geometry suites and the complete browser suite documented in `projects/svg-paint/QA.md`. Rebuild and test the standalone HTML when app code changes. For published changes, wait for Pages to finish and verify the deployed version. Report actual coverage and any browser/device limits; passing automation is not a claim that software is bug-free.
