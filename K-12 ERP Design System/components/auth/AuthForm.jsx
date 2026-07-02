import React from "react";
import { TextField } from "../inputs/TextField.jsx";
import { Button } from "../buttons/Button.jsx";
import { Checkbox } from "../selection/Checkbox.jsx";
import { InlineMessage } from "../feedback/InlineMessage.jsx";

/**
 * AuthForm — account access flows (login / forgot / reset). Presentational
 * shell composing fields + primary action inside a centered card. Provide
 * `onSubmit` and control state externally.
 */
export function AuthForm({
  mode = "login",
  brand,
  title,
  subtitle,
  error,
  loading = false,
  onSubmit,
  footer,
  className = "",
}) {
  const copy = {
    login: { title: "Sign in", subtitle: "Access your school workspace", submit: "Sign in" },
    "forgot-password": { title: "Reset password", subtitle: "We'll email you a reset link", submit: "Send reset link" },
    "reset-password": { title: "Set a new password", subtitle: "Choose a strong password", submit: "Update password" },
  }[mode] || {};

  return (
    <form
      className={["ds-auth", className].filter(Boolean).join(" ")}
      onSubmit={(e) => { e.preventDefault(); onSubmit && onSubmit(); }}
    >
      {brand && <div className="ds-auth__brand">{brand}</div>}
      <div className="ds-auth__head">
        <h1 className="ds-auth__title">{title || copy.title}</h1>
        <p className="ds-auth__subtitle">{subtitle || copy.subtitle}</p>
      </div>
      {error && <InlineMessage variant="error">{error}</InlineMessage>}
      <div className="ds-auth__fields">
        {mode === "reset-password" ? (
          <>
            <TextField label="New password" type="password" required />
            <TextField label="Confirm password" type="password" required />
          </>
        ) : (
          <>
            <TextField label="Email or username" type="text" iconStart="mail" required autoComplete="username" />
            {mode === "login" && <TextField label="Password" type="password" required autoComplete="current-password" />}
          </>
        )}
        {mode === "login" && (
          <div className="ds-auth__row">
            <Checkbox label="Remember me" size="sm" />
            <a className="ds-auth__link" href="#">Forgot password?</a>
          </div>
        )}
      </div>
      <Button type="submit" variant="primary" fullWidth loading={loading}>{copy.submit}</Button>
      {footer && <div className="ds-auth__footer">{footer}</div>}
    </form>
  );
}
