# Frontend Conventions

## Combining Tailwind classes

Use `cn()` from `~/lib/utils` for combining Tailwind classes. It's `clsx` + `tailwind-merge`.

## Component locations

Shadcn components live in `app/components/ui/`. Custom components go directly in `app/components/`. Don't nest component folders deeper than that.

## Price formatting

Price values are stored in cents (integers, see [database.md](database.md#price-values)). Use `formatPrice()` from `~/lib/utils` to display them — it handles the "Free" case for 0/null.
