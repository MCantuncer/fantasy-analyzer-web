# Phone styles

One file per phone fix. `main.tsx` loads every `*.css` file here after `index.css`, so a
new fix is a new file and never edits a shared stylesheet. Keep each file scoped to the
classes it fixes and explain the why in a comment.
