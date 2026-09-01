# Requirement Return Security Review

Scope: the `requirements` document transition from `incoming` back to `to_send`.

- The document schema remains unchanged and is validated by `validRequirement`.
- Only an active staff user assigned to the destination/requesting shop can return an incoming item.
- The return preserves the source and destination shops, product, quantity, creator, and creation time.
- The only allowed changed fields are `status` and the server-managed `updatedAt` timestamp.
- The original source shop cannot return its own sent item, and the rules test covers that denied case.

The existing admin path remains subject to the validated requirement schema.

## Company-Order Review

Scope: an admin moving a `required` record to the requesting shop's `incoming` list after confirming the company quantity.

- A company order uses the existing requirement document; it does not create a duplicate record or a second listener.
- The new `companyOrderQuantityReference` field is accepted only for an `incoming` record with no source shop and the requesting shop as its destination.
- Staff can create only normal `required` records and cannot set the company-order field or move a record into this state.
- The destination staff member may confirm receipt and remove the record, but cannot return a company order to another shop because there is no source shop.
- The rules test covers the denied staff transition, the permitted admin transition, and receipt by the destination staff member.
