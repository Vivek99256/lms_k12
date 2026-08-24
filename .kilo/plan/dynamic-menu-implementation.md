# Plan: Dynamic Sidebar Menu from Menu Rights API

## Objective
Replace the hardcoded `app/data/menuItems.ts` data with dynamic fetching from `POST /api/menu-rights`, so the sidebar renders menus based on the logged-in user's permissions.

## API Contract
- **Endpoint**: `POST {API_BASE_URL}/api/menu-rights`
- **Request Body**:
  ```json
  {
    "type": "API",
    "sub_institute_id": <from_login_response_or_ls>,
    "user_id": <from_login_response>,
    "user_profile_name": <from_login_response>,
    "user_profile_id": <from_login_response>
  }
  ```
- **Response Shape**:
  - `level 1` – top-level array (flat)
  - `level 2` – `{ parent_menu_id: { "0": [Item] } }` (one level deep, keyed by parent id)
  - `level 3` – `{ parent_menu_id: { "0": [Item] } }` (one level deep, keyed by parent id)
- **Item fields**: `id`, `name`, `menu_title`, `menu_sortorder`, `description`, `parent_menu_id`, `level`, `status`, `sort_order`, `link`, `icon`, `sub_institute_id`, `client_id`, `created_at`, `updated_at`, `menu_type`, `database_table`, `site_map_name`, `youtube_link`, `pdf_link`, `menu_path`, `quick_menu`, `dashboard_menu`, `text`

## Files to Create / Modify

### 1. `app/hooks/useMenuRights.ts` — NEW
- Custom React hook.
- Calls `POST /api/menu-rights` with the user context.
- Parses `level 1`, `level 2`, `level 3` into the existing `MenuItem[]` tree structure.
- Caches result in `sessionStorage` (or context).
- Exposes: `{ menuItems, loading, error, refetch }`

### 2. `contexts/AuthContext.tsx` — MODIFY
- Extend `AuthContextType` to include:
  - `menuData: { sub_institute_id: number; user_id: number; user_profile_name: string; user_profile_id: number } | null`
- After successful login, extract `sub_institute_id`, `user_id`, `user_profile_name`, `user_profile_id` from the login response and store them in both `localStorage` (`userMenuContext`) and state.
- Provide `refetchMenu` action.

### 3. `app/data/menuMappers.ts` — NEW
- Pure functions:
  - `mapApiIconToComponent(iconString: string): React.ComponentType` — maps known icon strings (e.g., `"school"`, `"mdi mdi-account fa-fw"` ) to lucide-react components; fallback to `Menu` icon if unknown.
  - `buildMenuTree(level1, level2, level3): MenuItem[]` — assembles nested tree.
- Re-use existing interfaces from `app/data/menuItems.ts`.

### 4. `app/data/menuItems.ts` — KEEP but mark as fallback
- Keep interfaces (`MenuItem`, `SubmenuItem`, `Level3Item`).
- Keep `getCurrentLevel3Menu`.
- Export an empty `menuItems` as fallback.
- No removal needed; existing imports from `Sidebar.tsx` and `DashboardShell.tsx` remain valid.

### 5. `app/components/Sidebar.tsx` — MODIFY
- Replace `import { menuItems as sharedMenuItems }` with `useMenuRights`.
- When `menuItems` are loading, render a skeleton/placeholder.
- Same flyout/submenu/Level-3 rendering, just driven by dynamic data.
- Preserve collapse/expand behavior and user card.

### 6. `app/components/DashboardShell.tsx` — MODIFY
- Use the dynamic menu data for `getCurrentLevel3Menu`.
- Ensure `Level3Subheader` receives dynamic Level-3 items.

### 7. `app/components/utils/api_url.tsx` — NO CHANGE
- Already provides `API_BASE_URL`.

## Implementation Order
1. Create `app/data/menuMappers.ts`
2. Update `contexts/AuthContext.tsx`
3. Create `app/hooks/useMenuRights.ts`
4. Update `app/components/Sidebar.tsx`
5. Update `app/components/DashboardShell.tsx`
6. Verify `.env.local` already has the dev URL (it does).

## Risks / Notes
- `level 2` and `level 3` keys are parent ids as strings (e.g., `"37"`, `"3"`, `"6"`). `parent_menu_id` is `0` in the nested object because the API wraps children under a `"0"` key. The mapper must drill through both keys.
- API icon strings may not map 1:1 to lucide-react. Implement a safe fallback so the UI never breaks.
- If the API is unreachable, fall back to an empty menu rather than crashing the whole layout.
