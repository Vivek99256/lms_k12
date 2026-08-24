import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * TopbarNav — global app bar: brand/module context, global search, and
 * trailing actions/account. Slots keep it flexible per role.
 */
export function TopbarNav({ brand, moduleContext, search, actions, account, className = "" }) {
  return (
    <header className={["ds-topbar", className].filter(Boolean).join(" ")}>
      <div className="ds-topbar__start">
        {brand && <div className="ds-topbar__brand">{brand}</div>}
        {moduleContext && <div className="ds-topbar__context">{moduleContext}</div>}
      </div>
      {search && <div className="ds-topbar__search">{search}</div>}
      <div className="ds-topbar__end">
        {actions}
        {account && <div className="ds-topbar__account">{account}</div>}
      </div>
    </header>
  );
}
