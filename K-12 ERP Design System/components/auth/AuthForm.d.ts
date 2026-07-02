import * as React from "react";

/**
 * Account access flows in a centered card (accessible-auth compliant: no
 * memory/puzzle dependence). Presentational shell — control state externally.
 *
 * @dsCard group="Components"
 */
export interface AuthFormProps {
  mode?: "login" | "forgot-password" | "reset-password";
  brand?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  error?: React.ReactNode;
  loading?: boolean;
  onSubmit?: () => void;
  footer?: React.ReactNode;
  className?: string;
}
export function AuthForm(props: AuthFormProps): JSX.Element;
