# Item Transfer Support Plan

This plan captures the intended architecture and staged implementation path for conduit item transfer support and the deepsight inventory client.

Each stage should leave the system testable through deepsight inventory or through deepsight observing conduit transfer events, operations, patches, and failures. A stage does not need to expose every possible route in the UI, but it must exercise the shape of the system end-to-end instead of landing as an isolated backend or framework layer.

## Goals

- Conduit owns item transfer action logic and account mutation boundaries.
- Conduit tracks current best-known item state while Bungie.net catches up.
- Clients receive small inventory model patches instead of refetching the full inventory for each transfer mutation.
- Deepsight inventory can trigger and observe transfer flows before drag/drop exists.
- Drag/drop later becomes a richer input surface over the same conduit transfer/planner loop.
- The UI shows pending movement and failure feedback without pretending that unconfirmed Bungie steps have succeeded.
- Unsupported routes fail honestly until planner support exists.

## Core Decisions

- Profile patches are the authoritative persisted mutation layer for Bungie-shaped state corrections.
- Known profile patch shapes derive streamed `Inventory` model patches for clients.
- Full `Inventory` rebroadcasts remain tied to inventory reads and fresh/cached refreshes, not ordinary transfer mutations.
- Profile patches are persisted in conduit and applied to cached model reads until fresh Bungie data supersedes them.
- Derived `Inventory` patches are streamed to clients as model deltas, not maintained as a second persisted patch layer.
- Transfer intent events are separate from confirmed state patches.
- Confirmed inventory patches are emitted only after Bungie accepts the concrete step that caused the profile patch.
- Conduit operations describe visible work; transfer operation ids describe transfer-domain intent/patch/failure/completion streams.
- Related operation/warning data should use lightweight item and character references, not full item or character payloads.
- Public transfer APIs stay specialized:
  - `vaultItem`
  - `moveItemToCharacter`
  - `equipItemOnCharacter`
  - `pullFromPostmaster` or equivalent when there is a public postmaster entrypoint
- The transfer planner is hybrid:
  - preflight obvious constraints from current state and definitions
  - adapt to known Bungie responses during execution
- Equipped-source transfers can auto-equip fallback items once planner support exists.
- Fallback selection uses least-disruptive ordering.
- Equip success patches infer both:
  - incoming item moving from character inventory to equipped items
  - previously equipped same-bucket item moving from equipped items to character inventory
- Transfer requests provide a recovery policy:
  - leave partial success
  - best-effort revert
- Deepsight drag/drop defaults to best-effort revert once drag/drop exists.
- Client drag/drop is desktop-first custom pointer drag.
- Touch drag support is out of scope for the first pass. Future mobile support should prefer context/menu actions.
- Kitsui drag/drop primitives should be created as part of the inventory drag/drop stage, with deepsight inventory as the first consumer.
- First-pass drag/drop skips keyboard accessibility, screen-reader parity, and detailed drag diagnostics.

## Stage 1 - Direct Click Transfer Slice

Make direct item transfers testable from deepsight inventory without drag/drop and without planner-backed multi-route behavior.

This stage proves the patch contract, transfer event contract, operation feedback, deepsight local state handling, and click-triggered direct actions end-to-end.

### Conduit State And Patch Contract

- [x] Keep raw path-shaped patch machinery owned by `src/service/model/DestinyProfiles.ts`.
- [x] Add a separate `ProfilePatch` registry/base class adjacent to profile models.
- [x] Register item-transfer-specific `ProfilePatch` shapes in `src/service/action/ItemTransfer.ts`.
- [x] Log an error through conduit logging utilities if duplicate profile patch ids register.
- [x] Stop duplicating raw profile override construction details outside registered patch shapes.
- [x] Preserve current profile override pruning against fresh Bungie response timestamps.
- [x] Persist known profile patch shapes through `Store.destinyProfileOverrides`.
- [x] Derive client-facing `Inventory` patch events from known profile patch shapes.
- [x] Make cached inventory reads reflect persisted profile patches.
- [x] Keep full `inventoryUpdated` tied to normal inventory reads/refreshes.

Known profile patch shapes:

- [x] Character inventory to vault.
- [x] Vault to character inventory.
- [x] Postmaster pull bucket correction.
- [x] Character inventory to character equipment.
- [x] Character equipment to character inventory caused by equip displacement.

### Transfer Broadcasts And Operations

- [x] Add typed transfer intent, confirmed inventory patch, failure, and completion broadcasts.
- [x] Keep transfer intent separate from confirmed inventory patches.
- [x] Emit confirmed inventory patches only after Bungie accepts the concrete step.
- [x] Add nested conduit operations for visible transfer work.
- [x] Add lightweight related item and character references for operations and warnings.
- [x] Ensure conduit operations end on failure.
- [x] Keep Stage 1 failure events honest by reporting no recovery execution until Stage 2 recovery exists.

### Direct Public APIs

- [x] Keep `vaultItem(item)`.
- [x] Keep `moveItemToCharacter(characterId, item)`.
- [x] Add direct `equipItemOnCharacter(characterId, item)`.
- [x] Preserve Level 1 account mutation checks with `Auth.assertOriginAccess(event.origin)` at service entrypoints.
- [x] Return honest failure for direct equip cases that require planner support.
- [x] Return honest failure for direct equip cases without an item instance id.

### Deepsight Inventory Integration

- [x] Display related item references in conduit operation/warning UI when the current provider can resolve them.
- [x] Display related character references in conduit operation/warning UI when the current provider is inventory-shaped.
- [x] Add direct click shortcuts for testing:
  - [x] Character inventory item left click equips it on that character.
  - [x] Character inventory item Ctrl+left click vaults it.
  - [x] Vault item left click moves it to the most recently used character.
- [x] Skip lost/postmaster click shortcuts until planner or explicit postmaster UI support exists.
- [x] Skip equipped-item transfer shortcuts until planner fallback support exists.
- [x] Subscribe to transfer intent, confirmed inventory patch, failure, and completion events in deepsight inventory state.
- [x] Apply incoming `Inventory` patch events to the currently displayed inventory without full refetch.
- [x] Keep accepting full `inventoryUpdated` events from normal cached/fresh inventory refreshes as authoritative replacements.
- [x] Show visible pending state for click-triggered transfers.
- [x] Clear pending state when confirming inventory patches arrive.
- [x] Show visible failure state when conduit reports transfer failure.
- [x] Avoid full inventory refetches for ordinary successful click-triggered transfer mutations.

### Stage 1 Manual Validation

- [x] Character inventory item left click equips it.
- [x] Character inventory item Ctrl+left click vaults it.
- [x] Vault item left click moves it to the most recently used character.
- [-] Operation toast shows high-level and concrete nested transfer operations. (Test result: UX around nested operations is rough, but does show them all)
- [x] Confirmed inventory patch updates the displayed inventory without a full inventory refetch.
- [x] Failed operation ends all conduit operations and does not leave stuck loading UI.
- [x] Reloaded client sees persisted best-known state through conduit cached inventory reads.

## Stage 2 - Inventory Drag/Drop

Add reusable drag/drop primitives as part of the deepsight inventory drag/drop implementation.

This stage should make drag/drop a richer input surface over the Stage 1 transfer loop, not a separate transfer system. Unsupported routes should fail honestly through the same conduit APIs, even if they are visible as drop targets in the UI. Unsupported routes become supported as the planner adds support for them.

### Kitsui Drag/Drop Primitives

- [ ] Add `Draggable` component extension or equivalent.
- [ ] Add `DropTarget` component extension or equivalent.
- [ ] Support typed payloads.
- [ ] Support drag groups or channels.
- [ ] Track active session state.
- [ ] Track source state.
- [ ] Track active target state.
- [ ] Support target priority for nested targets.
- [ ] Add movement threshold to avoid accidental drags.
- [ ] Add floating preview hook.
- [ ] Support async drop handling.
- [ ] Support cancel cleanup.
- [ ] Support disabled state.
- [ ] Preserve pointer offset.
- [ ] Clean up on route/component removal.
- [ ] Support viewport and scrolling behavior needed for long inventory pages.

Explicit first-pass exclusions:

- [ ] Keyboard drag/drop.
- [ ] Screen-reader parity.
- [ ] Detailed drag diagnostics.

### Deepsight Inventory Drag/Drop UI

- [ ] Use deepsight inventory as the first consumer of the kitsui drag/drop primitives.
- [ ] Drag items from character inventory.
- [ ] Drag items from vault.
- [ ] Drag items from equipped slots.
- [ ] Drop onto vault bucket/list.
- [ ] Drop onto character inventory bucket/list.
- [ ] Drop onto character equipped slot/list.
- [ ] Route drops through specialized conduit APIs/planner.
- [ ] Pass default recovery policy `best-effort revert`.
- [ ] Use existing transfer intent events for pending visuals.
- [ ] Settle visuals when confirming inventory patches arrive.
- [ ] Show failure state if conduit reports failure.
- [ ] Reuse Stage 1 local inventory patch application.
- [ ] Highlight best-effort legal targets and ignore obviously impossible targets.
- [ ] Reuse the existing inventory placeholder shimmer animation style for target highlight.
- [ ] Keep touch drag out of scope; future mobile support should prefer context/menu actions.

### Stage 2 Manual Validation

- [ ] Drag character inventory item to vault.
- [ ] Drag vault item to character inventory.
- [ ] Drag character inventory item to equipped slot.
- [ ] Drag equipped item to vault using planner fallback.
- [ ] Drag item to unsupported target and get honest failure/no-op.
- [ ] Cancel drag and verify cleanup.
- [ ] Navigate away during drag and verify cleanup.
- [ ] Long-page dragging remains usable near viewport edges.

## Stage 3 - Transfer Planner

Build the service-side planner behind the specialized transfer APIs so currently unsupported routes become supported without requiring new UI for every route.

This stage can support routes that deepsight inventory cannot fully represent yet, as long as the transfer event, operation, patch, and failure stream can be observed from deepsight.

### Planner State

- [ ] Start each operation from a working state snapshot:
  - [ ] current profile data
  - [ ] current resolved `Inventory`
  - [ ] persisted profile patches applied
  - [ ] definitions needed for bucket, class, equip, and transfer validation
- [ ] Apply each successful logical change to the planner working state.
- [ ] Keep planner state separate from persisted `Inventory` patch storage.

### Concrete Bungie-Backed Steps

- [ ] Pull from postmaster.
- [ ] Transfer to vault.
- [ ] Transfer from vault to character.
- [ ] Equip item on character.
- [ ] Equip fallback item.

After each successful Bungie-backed step:

- [ ] Persist the authoritative profile patch.
- [ ] Derive and broadcast inventory patch events.
- [ ] Apply the same logical change to the planner working state.

### Supported Routes

- [ ] Character inventory to vault.
- [ ] Vault to character inventory.
- [ ] Character inventory to equipped.
- [ ] Vault to equipped through character inventory.
- [ ] Other character inventory to target character inventory through vault.
- [ ] Other character inventory to target character equipped through vault.
- [ ] Equipped item to vault through fallback equip.
- [ ] Equipped item to another character inventory through fallback equip and vault.
- [ ] Equipped item to another character equipped slot through fallback equip, vault, and target equip.
- [ ] Postmaster pull routes internally, without requiring deepsight postmaster UI in this plan.

### Recovery And Failure Semantics

- [ ] Add options to public APIs for recovery policy and optional client operation id.
- [ ] Support recovery policies:
  - [ ] leave partial success
  - [ ] best-effort revert
- [ ] Default deepsight drag/drop to best-effort revert once drag/drop exists.
- [ ] Avoid blind repeated retries for unknown failures.
- [ ] Categorize known responses:
  - [ ] success
  - [ ] auth failure
  - [ ] stale location
  - [ ] equipped transfer restriction
  - [ ] bucket full
  - [ ] equip restriction
  - [ ] class restriction
  - [ ] exotic restriction
  - [ ] orbit/social-space restriction
  - [ ] transient Bungie/network failure
- [ ] Include operation id, failed step, interpreted reason, recovery policy, recovery result, and final best-known state when available.

### Fallback Selection

- [ ] Use least-disruptive fallback ordering:
  - [ ] same character inventory
  - [ ] vault
  - [ ] other characters
- [ ] Prefer legal, non-exotic, lower-disruption fallback items.
- [ ] Avoid moving other-character equipment unless necessary.
- [ ] Fail honestly if no legal fallback exists.

### Stage 3 Manual Validation

- [ ] Current Stage 1 click shortcuts continue to work through the planner.
- [ ] Unsupported Stage 1 click cases become supported when planner routes exist.
- [ ] Equipped-source moves use legal fallback or fail honestly.
- [ ] Partial success with leave-partial policy reports final best-known state.
- [ ] Partial success with best-effort revert reports recovery result.
- [ ] Postmaster route can be exercised through a manual conduit call while deepsight observes operations and patches.

## Stage 4 - Coverage, Polish, And Edge Cases

Harden the transfer system after the direct click slice, planner, and drag/drop input surface all exist.

### Edge Cases

- [ ] Source item no longer exists.
- [ ] Source item moved by another tab/client.
- [ ] Stale cached inventory.
- [ ] Bucket full.
- [ ] No legal fallback item.
- [ ] Fallback item exists only in vault.
- [ ] Fallback item exists only on another character.
- [ ] Exotic equip conflicts.
- [ ] Class-restricted armor.
- [ ] Postmaster item with missing or unknown bucket.
- [ ] Stackable items without instance ids.
- [ ] Multiple stackable items with the same hash and quantity.
- [ ] Equip succeeds but displaced item inference fails.
- [ ] Operation partially succeeds and recovery partially fails.
- [ ] Fresh inventory arrives during an active operation.

When state is uncertain, conduit should prefer honest failure reporting over inventing state.

### Optional UI Follow-Ups

- [ ] Add mobile/context menu transfer actions if desired.
- [ ] Add postmaster UI only if deepsight needs a first-class postmaster management surface.
- [ ] Add richer operation detail display if grouped operation labels and related references are not enough.
- [ ] Add detailed transfer diagnostics if planner debugging becomes difficult.

### Stage 4 Manual Validation

- [ ] Failure with best-effort revert.
- [ ] Failure with leave partial.
- [ ] Active client receives patches without full inventory refetch.
- [ ] Multiple active clients observe consistent best-known state.
- [ ] Reloaded client sees persisted best-known state through conduit cached inventory reads.
- [ ] Fresh inventory supersedes stale persisted profile patches correctly.

## Validation Commands

Use non-emitting validation commands unless explicit approval is given for emitting build/generation steps.

Conduit source validation:

```powershell
pnpm exec task validate
```

Deepsight source validation:

```powershell
pnpm exec tsc -p src\tsconfig.json --noEmit --incremental false
```

Kitsui source validation, when the drag/drop stage edits kitsui:

```powershell
pnpm exec tsc --noEmit --baseUrl src --moduleResolution node --target ES2022 --strict --esModuleInterop --allowJs --experimentalDecorators --skipLibCheck src\kitsui.ts
```

## Suggested Big Implementation Order

1. Direct click transfer slice.
2. Inventory drag/drop.
3. Transfer planner.
4. Coverage, polish, and edge cases.
