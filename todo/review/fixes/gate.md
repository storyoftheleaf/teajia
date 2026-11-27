
## The review-walks CI job waits

The job is kept as todo/review/review-walks-ci-job.patch and is not on main yet. The host and owner walks have no closed-switch mode: they fail rather than skip with --set live. With --set all, 13 steps still report open findings. Once the walks skip cleanly while closed and the open findings are fixed, apply the patch (`git apply todo/review/review-walks-ci-job.patch`).
