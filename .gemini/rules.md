# Antigravity Rules

## General Project Rules
- **Themes & Colors**: This project uses a custom theme where `--primary`, `--secondary`, and `--saffron` are ALL mapped to an orange color (`#EE6D23`).
- **Readability**: Because `bg-secondary`, `bg-primary`, and `bg-saffron` are all orange, DO NOT use `text-primary`, `text-secondary`, or `text-saffron` on them. Always use `text-primary-foreground`, `text-secondary-foreground`, or `text-white` on these backgrounds to ensure the text is legible.
- **Tools**: Always prefer using `grep_search` and `find_by_name`. Avoid `cat` in bash, avoid `sed` for replacing, and avoid `ls`.

## File Structure Context
- The web app is located in `apps/web/src`.
- Shared components are generally placed in `apps/web/src/shared/components`.
- Page routes are located in `apps/web/src/app`.
- Features/modules are located in `apps/web/src/features`.
