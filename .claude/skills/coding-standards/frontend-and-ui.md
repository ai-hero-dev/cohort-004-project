# Frontend & UI

## Combining tailwind classes

Use `cn()` from `~/lib/utils` — it's clsx + tailwind-merge.

## Component layout

- Shadcn components: `app/components/ui/`
- Custom components: directly in `app/components/`

Don't nest component folders deeper than that.

## Prices

Display prices via `formatPrice()` from `~/lib/utils`. Prices are stored in cents as integers; `formatPrice` handles the "Free" case for `0`/`null`.
