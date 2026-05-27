# TODO

- [ ] Plan-approved changes: consumer order flow
  - [ ] Remove quantity step: auto-set quantity = 1, remove quantity prompts/validation/ui.
  - [ ] Remove address step: skip address entry.
  - [ ] Auto-fill delivery place using device coordinates (longitude/latitude) and reverse-geocode to a place name/address.
  - [ ] Update order message payload and parsing to reflect delivery fields.
- [ ] Update any UI that shows progress steps or order summaries.
- [ ] Update any regex parsers that expect "delivery address" string.
- [ ] Run TypeScript/lint checks (if available) and sanity-check navigation.

